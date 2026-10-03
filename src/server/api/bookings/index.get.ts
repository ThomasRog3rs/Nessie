export default defineApiHandler(async (event): Promise<Booking[]> => {
  const bookerId = await requireBookerId(event)
  const { bookings } = await useServices()
  return bookings.list(bookerId)
})
