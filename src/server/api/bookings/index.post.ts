export default defineEventHandler(async (event): Promise<Booking> => {
  const body = await readBody<BookingRequest>(event)
  const fail = (message: string, statusCode = 400) => {
    throw createError({ statusCode, statusMessage: message, message })
  }

  if (body?.sitterId !== MOCK_SITTER.id) fail('Unknown sitter')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(body.endDate)) fail('Dates must be yyyy-mm-dd')
  if (nightsBetween(body.startDate, body.endDate) < 1) fail('The departure date must be after the arrival date')
  if (!/^\d{2}:\d{2}$/.test(body.arrivalTime) || !/^\d{2}:\d{2}$/.test(body.departureTime)) fail('Times must be HH:mm')
  if (!body.pets?.length) fail('Add at least one pet')
  if (!body.emergencyContact?.name || !body.emergencyContact?.phone) fail('An emergency contact is required')

  const clash = [...bookings.values()].find(b => ACTIVE_STATUSES.includes(b.status) && overlaps(b, body))
  if (clash) fail('These dates overlap an existing booking', 409)

  const now = new Date().toISOString()
  const booking: Booking = {
    ...body,
    id: crypto.randomUUID(),
    status: 'requested',
    timezone: MOCK_SITTER.timezone,
    createdAt: now,
    sitterName: MOCK_SITTER.name,
    rate: MOCK_SITTER.rate,
    rateBasis: MOCK_SITTER.rateBasis,
    history: [{
      id: crypto.randomUUID(),
      at: now,
      type: 'requested',
      actor: 'booker',
      message: `Requested ${body.startDate} to ${body.endDate}. Times are requested, not yet agreed.`,
    }],
  }
  bookings.set(booking.id, booking)
  setResponseStatus(event, 201)
  return booking
})
