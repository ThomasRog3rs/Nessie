export default defineApiHandler(async (): Promise<Booking[]> => {
  const { bookings, actors } = await useServices()
  return bookings.list(actors.bookerId())
})
