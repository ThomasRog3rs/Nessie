export default defineApiHandler(async (event): Promise<AvailabilityBlock[]> => {
  const sitterId = await requireSitterId(event)
  const { availabilityBlocks } = await useServices()
  return availabilityBlocks.list(sitterId)
})
