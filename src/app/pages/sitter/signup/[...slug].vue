<script setup lang="ts">
definePageMeta({ layout: 'auth' })
useHead({ title: 'Sitter sign up · Nesse' })

const { state, refresh } = useAccount()
const { isSignedIn, isLoaded } = useAuth()
const toast = useToast()

const form = reactive({
  name: '',
  location: '',
  phone: '',
  bio: '',
  rate: '',
  rateBasis: 'per_night' as 'per_night' | 'per_day',
  acceptedPets: ['Dog', 'Cat'] as string[],
  services: [] as { name: string, price: number }[],
})
const serviceName = ref('')
const servicePrice = ref('')
const error = ref('')
const saving = ref(false)

watch(() => [isLoaded.value, isSignedIn.value], async () => {
  if (isLoaded.value && isSignedIn.value) {
    const account = await refresh()
    if (account.role !== 'none') await navigateTo(homeFor(account.role))
  }
}, { immediate: true })

function addService() {
  const price = Number(servicePrice.value)
  if (!serviceName.value.trim() || !Number.isFinite(price) || price < 0) {
    error.value = 'Add a service name and a price of £0 or more.'
    return
  }
  form.services.push({ name: serviceName.value.trim(), price: Math.round(price * 100) })
  serviceName.value = servicePrice.value = error.value = ''
}

async function submit() {
  const rate = Number(form.rate)
  if (!Number.isFinite(rate) || rate <= 0) {
    error.value = 'Enter a rate greater than £0.'
    return
  }
  saving.value = true
  error.value = ''
  try {
    await $fetch('/api/account/sitter', {
      method: 'POST',
      body: {
        name: form.name,
        location: form.location,
        phone: form.phone,
        bio: form.bio,
        rate: Math.round(rate * 100),
        rateBasis: form.rateBasis,
        acceptedPets: form.acceptedPets,
        optionalServices: form.services,
      },
    })
    await refresh()
    toast.add({ title: 'Welcome to Nesse', icon: 'i-lucide-circle-check', color: 'success' })
    await navigateTo('/sitter')
  }
  catch (e) {
    error.value = apiErrorMessage(e)
    await refresh()
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="w-full">
    <div v-if="!isLoaded" class="py-10 text-center text-muted">Loading…</div>

    <template v-else-if="!state.sitterSignupOpen && state.role === 'none'">
      <UCard class="mx-auto max-w-md">
        <h1 class="text-2xl font-semibold">Sitter sign-up is closed</h1>
        <p class="mt-2 text-toned">A sitter has already set up this Nesse. If that's you, sign in. Bookers need an invite link from their sitter.</p>
        <UButton to="/sign-in" class="mt-4" size="lg">Sitter sign in</UButton>
      </UCard>
    </template>

    <div v-else-if="!isSignedIn" class="flex flex-col items-center gap-4">
      <h1 class="text-2xl font-semibold">Create your sitter account</h1>
      <SignUp path="/sitter/signup" sign-in-url="/sign-in" force-redirect-url="/sitter/signup" />
    </div>

    <form v-else-if="state.role === 'none'" class="space-y-6" @submit.prevent="submit">
      <div>
        <h1 class="text-3xl font-semibold">Set up your sitter profile</h1>
        <p class="mt-2 text-toned">Only one sitter can ever register, so this is your Nesse. You can change any of this later.</p>
      </div>

      <UCard>
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField label="Name" required><UInput v-model="form.name" required autocomplete="name" size="xl" class="w-full" /></UFormField>
          <UFormField label="Your area" required hint="Town or region only">
            <UInput v-model="form.location" required size="xl" class="w-full" />
          </UFormField>
          <UFormField label="Contact phone" required><UInput v-model="form.phone" required type="tel" autocomplete="tel" size="xl" class="w-full" /></UFormField>
        </div>
        <UFormField class="mt-4" label="About your approach" required>
          <UTextarea v-model="form.bio" required :rows="4" :maxlength="1000" class="w-full" />
        </UFormField>
      </UCard>

      <UCard>
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField label="Base rate (£)" required>
            <UInput v-model="form.rate" required type="number" min="0.01" step="0.01" size="xl" class="w-full" />
          </UFormField>
          <UFormField label="Rate basis" required>
            <USelect v-model="form.rateBasis" :items="[{ label: 'Per night', value: 'per_night' }, { label: 'Per day', value: 'per_day' }]" size="xl" class="w-full" />
          </UFormField>
        </div>
        <fieldset class="mt-5">
          <legend class="font-semibold">Pets you can care for</legend>
          <div class="mt-3 grid gap-2 sm:grid-cols-2">
            <label v-for="pet in PET_SPECIES" :key="pet" class="flex min-h-11 items-center gap-3 rounded-lg border border-default px-3">
              <input v-model="form.acceptedPets" type="checkbox" :value="pet" class="size-4 accent-primary">
              <span>{{ pet }}</span>
            </label>
          </div>
        </fieldset>
        <div class="mt-6 border-t border-default pt-5">
          <h2 class="font-semibold">Optional services</h2>
          <ul v-if="form.services.length" class="mt-3 divide-y divide-default rounded-xl border border-default">
            <li v-for="(service, i) in form.services" :key="i" class="flex items-center justify-between gap-3 p-3">
              <span class="font-semibold">{{ service.name }} <span class="font-normal text-muted">· {{ formatMoney(service.price) }} per night</span></span>
              <UButton type="button" color="error" variant="ghost" icon="i-lucide-trash-2" :aria-label="`Remove ${service.name}`" @click="form.services.splice(i, 1)" />
            </li>
          </ul>
          <div class="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:items-end">
            <UFormField label="Service name"><UInput v-model="serviceName" placeholder="e.g. Dog walking" size="xl" class="w-full" /></UFormField>
            <UFormField label="Price (£)"><UInput v-model="servicePrice" type="number" min="0" step="0.01" size="xl" class="w-full" /></UFormField>
            <UButton type="button" color="neutral" variant="outline" size="xl" icon="i-lucide-plus" @click="addService">Add</UButton>
          </div>
        </div>
      </UCard>

      <div v-if="error" role="alert" class="rounded-lg border border-error/30 bg-error/5 p-3 font-semibold text-error">{{ error }}</div>
      <div class="flex justify-end">
        <UButton type="submit" size="xl" icon="i-lucide-check" :loading="saving" :disabled="saving">Create sitter account</UButton>
      </div>
    </form>
  </div>
</template>
