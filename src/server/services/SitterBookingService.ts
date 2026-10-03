import type {
  AgreeTimesRequest, Booking, BookingAttachment, BookingProgressUpdate, ProgressUpdateInput,
  SitterBooking, SitterExpense, SitterExpenseInput,
} from '../../shared/types/booking.ts'
import { todayInTimeZone } from '../../shared/utils/dateRange.ts'
import { canApply } from '../domain/bookingStateMachine.ts'
import { InvalidTransitionError, NotFoundError, ValidationError } from '../domain/errors.ts'
import type { BookingCommands, BookingQueries, TransactionRunner } from '../repositories/contracts.ts'
import type { BookingLifecycle } from './BookingLifecycle.ts'
import type { Clock, IdGenerator } from './ports.ts'

export interface SitterBookingServiceDependencies {
  queries: BookingQueries
  commands: BookingCommands
  lifecycle: BookingLifecycle
  transactions: TransactionRunner
  clock: Clock
  ids: IdGenerator
}

/** Sitter-facing booking use cases: decide on requests, agree times, cancel and complete. */
export class SitterBookingService {
  private readonly deps: SitterBookingServiceDependencies

  constructor(deps: SitterBookingServiceDependencies) {
    this.deps = deps
  }

  async list(sitterId: string): Promise<SitterBooking[]> {
    return Promise.all((await this.deps.queries.listForSitter(sitterId)).map(booking => this.project(booking, sitterId)))
  }

  async get(sitterId: string, bookingId: string): Promise<SitterBooking> {
    return this.project(await this.require(sitterId, bookingId), sitterId)
  }

  accept(sitterId: string, bookingId: string): Promise<SitterBooking> {
    return this.act(sitterId, bookingId, 'accept', 'Request accepted. Exact handover times to follow.')
  }

  decline(sitterId: string, bookingId: string, reason?: string): Promise<SitterBooking> {
    const trimmed = reason?.trim()
    return this.act(sitterId, bookingId, 'decline', trimmed ? `Request declined: ${trimmed}` : 'Request declined.')
  }

  cancel(sitterId: string, bookingId: string, reason?: string): Promise<SitterBooking> {
    const trimmed = reason?.trim()
    return this.act(sitterId, bookingId, 'cancel', trimmed ? `Cancelled by the sitter: ${trimmed}` : 'Cancelled by the sitter.')
  }

  agreeTimes(sitterId: string, bookingId: string, times: AgreeTimesRequest): Promise<SitterBooking> {
    return this.act(sitterId, bookingId, 'agree_times',
      `Handover times confirmed: arrive ${times.arrivalTime}, depart ${times.departureTime}.`,
      booking => this.deps.commands.setAgreedTimes(booking.id, times.arrivalTime, times.departureTime, this.deps.clock.now().toISOString()))
  }

  complete(sitterId: string, bookingId: string): Promise<SitterBooking> {
    return this.act(sitterId, bookingId, 'complete', 'Stay completed.', async (booking) => {
      const stayEnded = todayInTimeZone(booking.timezone, this.deps.clock.now()) >= booking.endDate
      if (canApply(booking.status, 'complete') && !stayEnded) {
        throw new InvalidTransitionError('A booking can only be completed once the stay has ended')
      }
    })
  }

  addProgressUpdate(sitterId: string, bookingId: string, input: ProgressUpdateInput): Promise<BookingProgressUpdate> {
    return this.deps.transactions.run(async () => {
      const booking = await this.require(sitterId, bookingId)
      if (booking.status !== 'confirmed') {
        throw new InvalidTransitionError('Progress updates can only be added to a confirmed booking')
      }
      const now = this.deps.clock.now()
      const createdAt = now.toISOString()
      const update: BookingProgressUpdate = {
        id: this.deps.ids.next(),
        date: input.date ?? todayInTimeZone(booking.timezone, now),
        message: input.message,
        creatorId: sitterId,
        createdAt,
      }
      await this.deps.commands.insertProgressUpdate(bookingId, update)
      await this.record(bookingId, 'progress_update', `Progress update: ${input.message}`, createdAt)
      return update
    })
  }

  addExpense(
    sitterId: string,
    bookingId: string,
    input: SitterExpenseInput,
    receipt?: BookingAttachment & { storageKey: string },
  ): Promise<SitterExpense> {
    return this.deps.transactions.run(async () => {
      const booking = await this.require(sitterId, bookingId)
      if (!['confirmed', 'completed'].includes(booking.status)) {
        throw new InvalidTransitionError('Expenses can only be recorded for a confirmed or completed booking')
      }
      const expense: SitterExpense = {
        id: this.deps.ids.next(),
        ...input,
        creatorId: sitterId,
        createdAt: this.deps.clock.now().toISOString(),
      }
      await this.deps.commands.insertSitterExpense(bookingId, expense)
      await this.record(bookingId, 'expense_recorded', `Expense recorded: ${input.description} (£${(input.amount / 100).toFixed(2)}).`, expense.createdAt)
      if (receipt) {
        if (receipt.kind !== 'receipt' || receipt.expenseId !== undefined || receipt.bookingId !== bookingId) {
          throw new ValidationError('The receipt attachment is invalid', { receipt: ['Receipt must be attached to this booking expense'] })
        }
        await this.deps.commands.insertAttachment({ ...receipt, expenseId: expense.id })
        await this.record(bookingId, 'receipt_added', `Receipt added: ${receipt.fileName}.`, receipt.createdAt)
      }
      const savedReceipt = receipt ? await this.deps.queries.findAttachment(bookingId, receipt.id) : undefined
      return {
        ...expense,
        ...(savedReceipt ? { receipt: savedReceipt } : {}),
      }
    })
  }

  addAttachment(
    sitterId: string,
    bookingId: string,
    attachment: BookingAttachment & { storageKey: string },
  ): Promise<BookingAttachment> {
    return this.deps.transactions.run(async () => {
      const booking = await this.require(sitterId, bookingId)
      if (!['confirmed', 'completed'].includes(booking.status)) {
        throw new InvalidTransitionError('Attachments can only be added to a confirmed or completed booking')
      }
      const allowedTypes = attachment.kind === 'receipt'
        ? ['application/pdf', 'image/jpeg', 'image/png']
        : ['image/jpeg', 'image/png', 'image/webp']
      if (attachment.size < 1 || attachment.size > 10 * 1024 * 1024 || !allowedTypes.includes(attachment.mimeType)) {
        throw new ValidationError('The attachment is invalid', { file: ['The type or size is not allowed'] })
      }
      if (attachment.kind === 'receipt') {
        const expense = attachment.expenseId
          ? (await this.deps.queries.listSitterExpenses(bookingId)).find(item => item.id === attachment.expenseId)
          : undefined
        if (!expense) throw new NotFoundError('Expense not found')
      }
      if (attachment.kind === 'photo' && attachment.expenseId) {
        throw new ValidationError('The attachment is invalid', { expenseId: ['Photos cannot be linked to an expense'] })
      }
      await this.deps.commands.insertAttachment(attachment)
      const eventType = attachment.kind === 'receipt' ? 'receipt_added' : 'photo_added'
      const detail = attachment.kind === 'receipt' ? `Receipt added: ${attachment.fileName}.` : `Photo added: ${attachment.fileName}.`
      await this.record(bookingId, eventType, detail, attachment.createdAt)
      return (await this.deps.queries.findAttachment(bookingId, attachment.id))!
    })
  }

  removeAttachment(sitterId: string, bookingId: string, attachmentId: string): Promise<{ attachment: BookingAttachment, storageKey: string }> {
    return this.deps.transactions.run(async () => {
      await this.require(sitterId, bookingId)
      const [attachment, storageKey] = await Promise.all([
        this.deps.queries.findAttachment(bookingId, attachmentId),
        this.deps.queries.findAttachmentStorageKey(bookingId, attachmentId),
      ])
      if (!attachment || !storageKey) throw new NotFoundError('Attachment not found')
      await this.deps.commands.deleteAttachment(bookingId, attachmentId)
      await this.record(bookingId, 'attachment_removed', `Attachment removed: ${attachment.fileName}.`)
      return { attachment, storageKey }
    })
  }

  async getAttachment(sitterId: string, bookingId: string, attachmentId: string): Promise<{ attachment: BookingAttachment, storageKey: string }> {
    const booking = await this.require(sitterId, bookingId)
    if (!['confirmed', 'completed'].includes(booking.status)) throw new NotFoundError('Attachment not found')
    const [attachment, storageKey] = await Promise.all([
      this.deps.queries.findAttachment(bookingId, attachmentId),
      this.deps.queries.findAttachmentStorageKey(bookingId, attachmentId),
    ])
    if (!attachment || !storageKey) throw new NotFoundError('Attachment not found')
    return { attachment, storageKey }
  }

  private act(
    sitterId: string,
    bookingId: string,
    action: Parameters<BookingLifecycle['apply']>[1],
    message: string,
    beforeApply?: (booking: Booking) => Promise<void> | void,
  ): Promise<SitterBooking> {
    return this.deps.transactions.run(async () => {
      const booking = await this.require(sitterId, bookingId)
      await beforeApply?.(booking)
      await this.deps.lifecycle.apply(booking, action, 'sitter', message)
      return this.project(await this.require(sitterId, bookingId), sitterId)
    })
  }

  private async require(sitterId: string, bookingId: string): Promise<Booking> {
    const booking = await this.deps.queries.findForSitter(bookingId, sitterId)
    if (!booking) throw new NotFoundError('Booking not found')
    return booking
  }

  private async project(booking: Booking, sitterId: string): Promise<SitterBooking> {
    const {
      propertyInstructions, emergencyContact, vet, emergencyInstructions, ...safeBooking
    } = booking
    const discloseSensitiveDetails = ['confirmed', 'completed'].includes(booking.status)
    const [progressUpdates, sitterExpenses, attachments, bookerName] = await Promise.all([
      this.deps.queries.listProgressUpdates(booking.id),
      this.deps.queries.listSitterExpenses(booking.id),
      this.deps.queries.listAttachments(booking.id),
      this.deps.queries.findBookerNameForSitter(booking.id, sitterId),
    ])
    return {
      ...safeBooking,
      bookerName: bookerName ?? '',
      ...(discloseSensitiveDetails ? { propertyInstructions, emergencyContact, vet, emergencyInstructions } : {}),
      progressUpdates,
      sitterExpenses,
      attachments,
    }
  }

  private async record(
    bookingId: string,
    type: Parameters<BookingCommands['appendHistory']>[1]['type'],
    message: string,
    at?: string,
  ): Promise<void> {
    await this.deps.commands.appendHistory(bookingId, {
      id: this.deps.ids.next(),
      at: at ?? this.deps.clock.now().toISOString(),
      type,
      actor: 'sitter',
      message,
    })
  }
}
