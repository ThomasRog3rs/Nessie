export function useMediaQuery(query: string) {
  const matches = ref(false)
  onMounted(() => {
    const mql = window.matchMedia(query)
    matches.value = mql.matches
    const onChange = (e: MediaQueryListEvent) => { matches.value = e.matches }
    mql.addEventListener('change', onChange)
    onBeforeUnmount(() => mql.removeEventListener('change', onChange))
  })
  return matches
}
