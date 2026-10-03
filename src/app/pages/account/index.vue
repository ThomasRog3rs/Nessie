<script setup lang="ts">
useHead({ title: 'Your details · Nesse' })

const toast = useToast()
const { data } = await useFetch<BookerProfile>('/api/booker/profile')
const profile = ref<BookerProfileInput>(data.value ? structuredClone(toRaw(data.value)) : emptyBookerProfile())
const error = ref('')
const saving = ref(false)

async function save() {
  saving.value = true
  error.value = ''
  try {
    const { email: _email, ...body } = profile.value as BookerProfile
    await $fetch('/api/booker/profile', { method: 'PATCH', body })
    toast.add({ title: 'Details saved', icon: 'i-lucide-circle-check', color: 'success' })
  }
  catch (e) {
    error.value = apiErrorMessage(e)
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <h1 class="text-3xl font-semibold">Your details</h1>
    <p class="mt-2 max-w-prose text-muted">These are used to fill in new bookings for you.</p>
    <p v-if="data?.email" class="mt-1 text-sm text-muted">Signed in as {{ data.email }}</p>
    <div class="mt-8">
      <BookerProfileForm v-model="profile" submit-label="Save details" :loading="saving" :error="error" @submit="save" />
    </div>
  </div>
</template>
