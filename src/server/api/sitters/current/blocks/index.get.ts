export default defineApiHandler(async (): Promise<AvailabilityBlock[]> => {
  const { availabilityBlocks, actors } = await useServices()
  return availabilityBlocks.list(actors.sitterId())
})
