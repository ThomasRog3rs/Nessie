const PUBLIC_PREFIXES = ['/sign-in', '/sitter/signup', '/join/']

export default defineNuxtRouteMiddleware(async (to) => {
  const account = await useAccount().refresh()
  if (PUBLIC_PREFIXES.some(prefix => to.path.startsWith(prefix))) return

  if (account.role === 'none') return navigateTo('/sign-in')
  const home = homeFor(account.role)
  if (to.path === '/') return navigateTo(home)
  const inSitterArea = to.path === '/sitter' || to.path.startsWith('/sitter/')
  if (inSitterArea !== (account.role === 'sitter')) return navigateTo(home)
})
