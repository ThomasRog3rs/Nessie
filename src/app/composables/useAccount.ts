/** Who the server says is signed in, and whether the one-off sitter sign-up is still open. */
export function useAccount() {
  const state = useState<AccountState>('account', () => ({ signedIn: false, role: 'none', sitterSignupOpen: false }))

  async function refresh(): Promise<AccountState> {
    state.value = await useRequestFetch()<AccountState>('/api/account')
    return state.value
  }

  return { state, refresh }
}

export function homeFor(role: AccountRole): string {
  return role === 'sitter' ? '/sitter' : '/book'
}
