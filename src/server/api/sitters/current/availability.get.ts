import { availabilityQuerySchema } from '../../../../shared/schemas/booking'

export default defineApiHandler(async (event): Promise<AvailabilityDay[]> => {
  const bookerId = await requireBookerId(event)
  const { from, to } = parseQuery(event, availabilityQuerySchema)
  const { availability, sitters } = await useServices()
  const sitter = await sitters.getPreferredSitter(bookerId)
  return availability.getDays(sitter.id, from, to)
})
