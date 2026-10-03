export default defineApiHandler(async (event): Promise<Sitter> => {
  const bookerId = await requireBookerId(event)
  const { sitters } = await useServices()
  return sitters.getPreferredSitter(bookerId)
})
