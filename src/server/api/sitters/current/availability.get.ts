import { availabilityQuerySchema } from '../../../../shared/schemas/booking'

export default defineApiHandler(async (event): Promise<AvailabilityDay[]> => {
  const { from, to } = parseQuery(event, availabilityQuerySchema)
  const { availability, sitters, actors } = await useServices()
  const sitter = sitters.getPreferredSitter(actors.bookerId())
  return availability.getDays(sitter.id, from, to)
})
