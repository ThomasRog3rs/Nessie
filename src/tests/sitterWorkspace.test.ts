import { describe, expect, it } from 'vitest'
import { ConflictError, InvalidTransitionError, NotFoundError, ValidationError } from '../server/domain/errors.ts'
import { progressUpdateSchema, sitterExpenseSchema, sitterProfileInputSchema } from '../shared/schemas/sitter.ts'
import { bookingRequest, createContext } from './helpers.ts'

describe('sitter profile and booking workspace', () => {
  it('validates profile, progress and integer-pence expense inputs', () => {
    expect(sitterProfileInputSchema.safeParse({
      name: '',
      location: 'Bristol',
      bio: '',
      phone: '',
      rate: 1000.5,
      rateBasis: 'per_hour',
      acceptedPets: [],
      optionalServices: [],
    }).success).toBe(false)
    expect(progressUpdateSchema.safeParse({ message: 'Update', date: '2030-02-30' }).success).toBe(false)
    expect(sitterExpenseSchema.safeParse({ category: 'travel', description: 'Train', amount: 100.5 }).success).toBe(false)
  })

  it('persists profile edits and rejects invalid service ownership', async () => {
    const context = await createContext()
    const before = await context.services.sitters.getCurrentProfile(context.sitterId)
    const updated = await context.services.sitters.updateCurrentProfile(context.sitterId, {
      name: 'Taylor Sitter',
      location: 'Bath, UK',
      bio: 'Calm and experienced pet care.',
      phone: '07123 456789',
      rate: 7200,
      rateBasis: 'per_day',
      acceptedPets: ['Dog', 'Cat'],
      optionalServices: [
        { id: before.optionalServices[0]!.id, name: 'Dog walks', price: 1500 },
        { name: 'Plant care', price: 500 },
      ],
    })

    expect(updated).toMatchObject({
      name: 'Taylor Sitter',
      location: 'Bath, UK',
      phone: '07123 456789',
      rate: 7200,
      rateBasis: 'per_day',
      acceptedPets: ['Dog', 'Cat'],
    })
    expect(updated.optionalServices.map(service => service.name)).toEqual(['Dog walks', 'Plant care'])
    await expect(context.services.sitters.updateCurrentProfile(context.sitterId, {
      name: 'Changed',
      location: 'Bath',
      bio: '',
      phone: '',
      rate: 5000,
      rateBasis: 'per_night',
      acceptedPets: ['Dog', 'dog'],
      optionalServices: [{ id: 'foreign-service-id', name: 'Other', price: 1 }],
    })).rejects.toThrow(ValidationError)
    expect((await context.services.sitters.getCurrentProfile(context.sitterId)).name).toBe('Taylor Sitter')
    context.db.close()
  })

  it('keeps request, accepted, and confirmed states distinct and withholds sensitive details until confirmed', async () => {
    const context = await createContext()
    const booking = await context.services.bookings.create(context.bookerId, bookingRequest(3, 5, {
      arrivalTime: '08:00',
      departureTime: '19:00',
      propertyInstructions: 'Key safe at the rear entrance.',
      emergencyContact: { name: 'Private Contact', phone: '07111 222333', relationship: 'Friend' },
      vet: { name: 'Private Veterinary Surgery', phone: '07111 111111' },
      emergencyInstructions: 'Call the contact first.',
    }))
    const sitterBookings = context.services.sitterBookings

    const requested = await sitterBookings.get(context.sitterId, booking.id)
    expect(requested.status).toBe('requested')
    expect(requested).not.toHaveProperty('propertyInstructions')
    expect(requested).not.toHaveProperty('emergencyContact')
    expect(requested).not.toHaveProperty('vet')
    expect(requested).not.toHaveProperty('emergencyInstructions')
    expect((await sitterBookings.list(context.sitterId)).find(item => item.id === booking.id)?.bookerName).toBe('Demo Booker')

    expect((await sitterBookings.accept(context.sitterId, booking.id)).status).toBe('accepted_times_pending')
    expect(await sitterBookings.get(context.sitterId, booking.id)).not.toHaveProperty('emergencyContact')
    await expect(sitterBookings.agreeTimes('other-sitter', booking.id, {
      arrivalTime: '09:00', departureTime: '18:00',
    })).rejects.toThrow(NotFoundError)

    const confirmed = await sitterBookings.agreeTimes(context.sitterId, booking.id, {
      arrivalTime: '10:30',
      departureTime: '17:30',
    })
    expect(confirmed).toMatchObject({
      status: 'confirmed',
      arrivalTime: '08:00',
      agreedArrivalTime: '10:30',
      agreedDepartureTime: '17:30',
      propertyInstructions: 'Key safe at the rear entrance.',
      emergencyContact: { name: 'Private Contact' },
      vet: { name: 'Private Veterinary Surgery' },
    })
    context.db.close()
  })

  it('shows the booker recorded expenses and receipts, but not other bookers\' receipts', async () => {
    const context = await createContext()
    const { bookings, sitterBookings } = context.services
    const booking = await bookings.create(context.bookerId, bookingRequest(3, 5))
    await sitterBookings.accept(context.sitterId, booking.id)
    await sitterBookings.agreeTimes(context.sitterId, booking.id, { arrivalTime: '10:00', departureTime: '17:00' })
    await sitterBookings.addExpense(context.sitterId, booking.id, { category: 'travel', description: 'Train', amount: 2800 }, {
      id: 'receipt-1', bookingId: booking.id, kind: 'receipt', fileName: 'train.pdf', mimeType: 'application/pdf',
      size: 10, creatorId: context.sitterId, createdAt: new Date().toISOString(), storageKey: 'key-1',
    })

    const detail = await bookings.get(context.bookerId, booking.id)
    expect(detail.sitterExpenses).toHaveLength(1)
    expect(detail.sitterExpenses[0]).toMatchObject({ amount: 2800, receipt: { id: 'receipt-1' } })
    expect(JSON.stringify(detail)).not.toContain('key-1')
    expect((await bookings.getReceipt(context.bookerId, booking.id, 'receipt-1')).storageKey).toBe('key-1')
    await expect(bookings.getReceipt('someone-else', booking.id, 'receipt-1')).rejects.toThrow(NotFoundError)
    await expect(bookings.getReceipt(context.bookerId, booking.id, 'missing')).rejects.toThrow(NotFoundError)
    context.db.close()
  })

  it('rejects overlapping unavailable blocks and records explicit cancellation history', async () => {
    const context = await createContext()
    const booking = await context.services.bookings.create(context.bookerId, bookingRequest(3, 5))
    await expect(context.services.availabilityBlocks.create(context.sitterId, {
      startDate: booking.startDate,
      endDate: booking.endDate,
      reason: 'Unavailable',
    })).rejects.toThrow(ConflictError)

    await context.services.sitterBookings.accept(context.sitterId, booking.id)
    const cancelled = await context.services.sitterBookings.cancel(context.sitterId, booking.id, 'Plans changed')
    expect(cancelled.status).toBe('cancelled')
    expect(cancelled.history.at(-1)).toMatchObject({
      type: 'cancelled',
      actor: 'sitter',
      message: 'Cancelled by the sitter: Plans changed',
    })
    context.db.close()
  })

  it('stores progress updates, itemized expenses, receipt metadata, and attachment history only for confirmed bookings', async () => {
    const context = await createContext()
    const booking = await context.services.bookings.create(context.bookerId, bookingRequest(3, 5))
    const sitterBookings = context.services.sitterBookings
    await expect(sitterBookings.addProgressUpdate(context.sitterId, booking.id, { message: 'Hello' }))
      .rejects.toThrow(InvalidTransitionError)

    await sitterBookings.accept(context.sitterId, booking.id)
    await sitterBookings.agreeTimes(context.sitterId, booking.id, { arrivalTime: '09:00', departureTime: '18:00' })
    const update = await sitterBookings.addProgressUpdate(context.sitterId, booking.id, {
      message: 'The pets have settled in.',
      date: '2030-01-04',
    })
    const expense = await sitterBookings.addExpense(context.sitterId, booking.id, {
      category: 'travel',
      description: 'Return train ticket',
      amount: 3400,
    }, {
      id: 'attachment-receipt',
      bookingId: booking.id,
      kind: 'receipt',
      fileName: 'receipt.pdf',
      mimeType: 'application/pdf',
      size: 512,
      creatorId: context.sitterId,
      createdAt: new Date('2030-01-01T12:00:00Z').toISOString(),
      storageKey: '00000000-0000-4000-8000-000000000001',
    })
    const photo = await sitterBookings.addAttachment(context.sitterId, booking.id, {
      id: 'attachment-photo',
      bookingId: booking.id,
      kind: 'photo',
      fileName: 'garden.png',
      mimeType: 'image/png',
      size: 2048,
      caption: 'Afternoon walk complete.',
      creatorId: context.sitterId,
      createdAt: new Date('2030-01-01T12:05:00Z').toISOString(),
      storageKey: '00000000-0000-4000-8000-000000000002',
    })

    expect(update).toMatchObject({ message: 'The pets have settled in.', date: '2030-01-04' })
    expect(expense).toMatchObject({ amount: 3400, receipt: { id: 'attachment-receipt' } })
    expect(photo).toMatchObject({ kind: 'photo', caption: 'Afternoon walk complete.' })

    const detail = await sitterBookings.get(context.sitterId, booking.id)
    expect(detail.progressUpdates).toMatchObject([{ id: update.id }])
    expect(detail.sitterExpenses).toMatchObject([{ id: expense.id, receipt: { id: 'attachment-receipt' } }])
    expect(detail.attachments.map(attachment => attachment.id)).toEqual(['attachment-receipt', 'attachment-photo'])
    expect(detail.history.slice(-4).map(item => item.type)).toEqual(['progress_update', 'expense_recorded', 'receipt_added', 'photo_added'])
    expect((await sitterBookings.removeAttachment(context.sitterId, booking.id, 'attachment-photo')).storageKey)
      .toBe('00000000-0000-4000-8000-000000000002')
    await expect(sitterBookings.getAttachment(context.sitterId, booking.id, 'attachment-photo')).rejects.toThrow(NotFoundError)
    context.db.close()
  })
})
