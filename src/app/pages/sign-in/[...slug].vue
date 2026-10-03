<script setup lang="ts">
definePageMeta({ layout: 'auth' })
useHead({ title: 'Sign in · Nesse' })

const { state, refresh } = useAccount()
const { isSignedIn, isLoaded } = useAuth()

watch(() => [isLoaded.value, isSignedIn.value], async () => {
  if (isLoaded.value && isSignedIn.value) {
    const account = await refresh()
    if (account.role !== 'none') await navigateTo(homeFor(account.role))
  }
}, { immediate: true })
</script>

<template>
  <div class="flex w-full flex-col items-center gap-6">
    <template v-if="isLoaded && isSignedIn && state.role === 'none'">
      <UCard class="w-full max-w-md">
        <h1 class="text-2xl font-semibold">Your account isn't set up yet</h1>
        <p class="mt-2 text-toned">
          Nesse is private. Bookers join using a link from their sitter.
          <template v-if="state.sitterSignupOpen">If you are the sitter, create the sitter account instead.</template>
        </p>
        <div class="mt-4 flex flex-wrap gap-3">
          <UButton v-if="state.sitterSignupOpen" to="/sitter/signup" size="lg">Create sitter account</UButton>
          <SignOutButton>
            <UButton color="neutral" variant="outline" size="lg">Sign out</UButton>
          </SignOutButton>
        </div>
      </UCard>
    </template>
    <template v-else>
      <SignIn fallback-redirect-url="/" :appearance="{ elements: { footerAction: 'hidden' } }" />
      <p class="max-w-md text-center text-sm text-muted">
        Joining as a booker? Use the invite link your sitter sent you.
        <template v-if="state.sitterSignupOpen">
          Setting up as the sitter?
          <NuxtLink to="/sitter/signup" class="font-semibold text-primary underline">Create the sitter account</NuxtLink>.
        </template>
      </p>
    </template>
  </div>
</template>
