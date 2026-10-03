import type { BookerBooking, Booking, BookingAttachment, BookingRequest, Sitter } from '../../shared/types/booking.ts'
import { calculatePricing } from '../../shared/utils/pricing.ts'
import { stayNights, todayInTimeZone } from '../../shared/utils/dateRange.ts'
import { ConflictError, NotFoundError, ValidationError } from '../domain/errors.ts'
import type { BookingCommands, BookingQueries, SitterRepository, TransactionRunner } from '../repositories/contracts.ts'
import type { AvailabilityService } from './AvailabilityService.ts'
import type { BookingLifecycle } from './BookingLifecycle.ts'
import type { Clock, IdGenerator } from './ports.ts'

export interface BookingServiceDependencies {
  sitters: SitterRepository
  queries: BookingQueries
  commands: BookingCommands
  availability: AvailabilityService
  lifecycle: BookingLifecycle
  transactions: TransactionRunner
  clock: Clock
  ids: IdGenerator
}

/** Booker-facing booking use cases. */
export class BookingService {
  private readonly deps: BookingServiceDependencies

  constructor(deps: BookingServiceDependencies) {
    this.deps = deps
  }

  list(bookerId: string): Promise<Booking[]> {
    return this.deps.queries.listForBooker(bookerId)
  }

  async get(bookerId: string, bookingId: string): Promise<BookerBooking> {
    const booking = await this.require(bookerId, bookingId)
    return {
      ...booking,
      sitterExpenses: await this.deps.queries.listSitterExpenses(booking.id),
      attachments: await this.deps.queries.listAttachments(booking.id),
    }
  }

  async getReceipt(bookerId: string, bookingId: string, attachmentId: string): Promise<{ attachment: BookingAttachment, storageKey: string }> {
    await this.require(bookerId, bookingId)
    const [attachment, storageKey] = await Promise.all([
      this.deps.queries.findAttachment(bookingId, attachmentId),
      this.deps.queries.findAttachmentStorageKey(bookingId, attachmentId),
    ])
    if (!attachment || attachment.kind !== 'receipt' || !storageKey) throw new NotFoundError('Receipt not found')
    return { attachment, storageKey }
  }

  async getAttachment(bookerId: string, bookingId: string, attachmentId: string): Promise<{ attachment: BookingAttachment, storageKey: string }> {
    await this.require(bookerId, bookingId)
    const [attachment, storageKey] = await Promise.all([
      this.deps.queries.findAttachment(bookingId, attachmentId),
      this.deps.queries.findAttachmentStorageKey(bookingId, attachmentId),
    ])
    if (!attachment || !storageKey) throw new NotFoundError('Attachment not found')
    return { attachment, storageKey }
  }

  async create(bookerId: string, request: BookingRequest): Promise<Booking> {
    const { sitters, availability, commands, transactions, clock, ids } = this.deps
    const sitter = await sitters.findPreferredForBooker(bookerId)
    if (!sitter || sitter.id !== request.sitterId) throw new NotFoundError('Unknown sitter')

    this.assertRequestable(sitter, request)

    return transactions.run(async () => {
      const conflict = await availability.findStayConflict(sitter.id, request.startDate, request.endDate)
      if (conflict === 'blocked') throw new ConflictError('The sitter is not available on some of these dates')
      if (conflict === 'booked') throw new ConflictError('These dates overlap an existing booking')

      const createdAt = clock.now().toISOString()
      const services = sitter.optionalServices.filter(service => request.optionalServiceIds.includes(service.id))
      const booking: Booking = {
        ...request,
        id: ids.next(),
        status: 'requested',
        timezone: sitter.timezone,
        createdAt,
        sitterName: sitter.name,
        rate: sitter.rate,
        rateBasis: sitter.rateBasis,
        services,
        agreedArrivalTime: null,
        agreedDepartureTime: null,
        pricing: calculatePricing({
          nights: stayNights(request.startDate, request.endDate).length,
          rate: sitter.rate,
          services,
          travelAmount: request.travelReimbursement.amount,
          incidentalExpenses: request.incidentalExpenses,
        }),
        history: [{
          id: ids.next(),
          at: createdAt,
          type: 'requested',
          actor: 'booker',
          message: `Requested ${request.startDate} to ${request.endDate}. Times are requested, not yet agreed.`,
        }],
      }
      await commands.insert({ booking, bookerId, sitterId: sitter.id })
      return booking
    })
  }

  cancel(bookerId: string, bookingId: string, reason?: string): Promise<Booking> {
    return this.deps.transactions.run(async () => {
      const booking = await this.require(bookerId, bookingId)
      const trimmed = reason?.trim()
      await this.deps.lifecycle.apply(booking, 'cancel', 'booker', trimmed ? `Cancelled by the booker: ${trimmed}` : 'Cancelled by the booker.')
      return this.require(bookerId, bookingId)
    })
  }

  private async require(bookerId: string, bookingId: string): Promise<Booking> {
    const booking = await this.deps.queries.findForBooker(bookingId, bookerId)
    if (!booking) throw new NotFoundError('Booking not found')
    return booking
  }

  private assertRequestable(sitter: Sitter, request: BookingRequest): void {
    const fieldErrors: Record<string, string[]> = {}

    if (request.startDate < todayInTimeZone(sitter.timezone, this.deps.clock.now())) {
      fieldErrors.startDate = ['The arrival date cannot be in the past']
    }

    const accepted = new Set(sitter.acceptedPets.map(species => species.toLowerCase()))
    const unaccepted = request.pets.filter(pet => !accepted.has(pet.species.toLowerCase())).map(pet => pet.species)
    if (unaccepted.length > 0) fieldErrors.pets = [`${sitter.name} does not accept: ${[...new Set(unaccepted)].join(', ')}`]

    const offered = new Set(sitter.optionalServices.map(service => service.id))
    if (request.optionalServiceIds.some(id => !offered.has(id))) {
      fieldErrors.optionalServiceIds = ['One or more selected services are not offered']
    }

    if (Object.keys(fieldErrors).length > 0) throw new ValidationError('The booking request is invalid', fieldErrors)
  }
}
