<script setup lang="ts">
definePageMeta({ layout: 'auth' })
useHead({ title: 'Join · Nesse' })

const route = useRoute()
const token = computed(() => String(route.params.token))
const { state, refresh } = useAccount()
const { isSignedIn, isLoaded } = useAuth()
const toast = useToast()

const { data: invite, refresh: refreshInvite } = await useFetch<InvitePreview>(() => `/api/join/${token.value}`, { key: `invite-${token.value}` })

const profile = ref(emptyBookerProfile())
const error = ref('')
const saving = ref(false)

watch(() => [isLoaded.value, isSignedIn.value], async () => {
  if (isLoaded.value && isSignedIn.value) {
    const account = await refresh()
    if (account.role !== 'none') await navigateTo(homeFor(account.role))
  }
}, { immediate: true })

async function submit() {
  saving.value = true
  error.value = ''
  try {
    await $fetch(`/api/join/${token.value}`, { method: 'POST', body: profile.value })
    await refresh()
    toast.add({ title: 'Welcome to Nesse', icon: 'i-lucide-circle-check', color: 'success' })
    await navigateTo('/book')
  }
  catch (e) {
    error.value = apiErrorMessage(e)
    await refreshInvite()
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="w-full">
    <UCard v-if="!invite?.valid && !(isSignedIn && state.role !== 'none')" class="mx-auto max-w-md">
      <h1 class="text-2xl font-semibold">This link can't be used</h1>
      <p class="mt-2 text-toned">It may have expired, been switched off or already been used. Ask your sitter for a new invite link.</p>
      <UButton to="/sign-in" class="mt-4" color="neutral" variant="outline" size="lg">Already have an account? Sign in</UButton>
    </UCard>

    <div v-else-if="!isLoaded" class="py-10 text-center text-muted">Loading…</div>

    <div v-else-if="!isSignedIn" class="flex flex-col items-center gap-4">
      <h1 class="text-2xl font-semibold">{{ invite?.sitterName ? `${invite.sitterName} invited you to Nesse` : 'You\'re invited to Nesse' }}</h1>
      <SignUp :path="`/join/${token}`" sign-in-url="/sign-in" :force-redirect-url="`/join/${token}`" />
    </div>

    <div v-else-if="state.role === 'none'" class="space-y-6">
      <div>
        <h1 class="text-3xl font-semibold">Tell us about you and your pets</h1>
        <p class="mt-2 text-toned">We'll use this to fill in your bookings with {{ invite?.sitterName || 'your sitter' }}. You can change it any time.</p>
      </div>
      <BookerProfileForm v-model="profile" submit-label="Finish signing up" :loading="saving" :error="error" @submit="submit" />
    </div>
  </div>
</template>
