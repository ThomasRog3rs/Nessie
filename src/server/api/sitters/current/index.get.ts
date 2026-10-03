export default defineApiHandler(async (): Promise<Sitter> => {
  const { sitters, actors } = await useServices()
  return sitters.getPreferredSitter(actors.bookerId())
})
