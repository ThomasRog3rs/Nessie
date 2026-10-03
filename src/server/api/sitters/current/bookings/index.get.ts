export default defineApiHandler(async (): Promise<Booking[]> => {
  const { sitterBookings, actors } = await useServices()
  return sitterBookings.list(actors.sitterId())
})
