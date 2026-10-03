<script setup lang="ts">
definePageMeta({ layout: 'sitter' })
useHead({ title: 'Sitter profile · Nesse' })

const workspace = useSitterWorkspace()
const toast = useToast()
const profile = workspace.profile
const petsOffered = ['Dogs', 'Cats', 'Small animals', 'Birds', 'Other']
const draft = reactive({
  name: profile.value.name,
  location: profile.value.location,
  bio: profile.value.bio,
  rate: (profile.value.ratePence / 100).toFixed(2),
  rateBasis: profile.value.rateBasis,
  acceptedPets: [...profile.value.acceptedPets],
  phone: profile.value.phone,
  services: profile.value.services.map(service => ({ ...service })),
})
const serviceName = ref('')
const servicePrice = ref('')
const formError = ref('')
const saving = ref(false)

function addService() {
  const name = serviceName.value.trim()
  const price = Number(servicePrice.value)
  if (!name || !Number.isFinite(price) || price < 0) {
    formError.value = 'Add a service name and a valid price of £0 or more.'
    return
  }
  draft.services.push({ id: `service-${Date.now()}`, name, pricePence: Math.round(price * 100) })
  serviceName.value = ''
  servicePrice.value = ''
  formError.value = ''
}

function saveProfile() {
  const rate = Number(draft.rate)
  if (!draft.name.trim() || !draft.location.trim() || !draft.bio.trim() || !Number.isFinite(rate) || rate <= 0) {
    formError.value = 'Add your name, area, bio and a rate greater than £0 before saving.'
    return
  }
  saving.value = true
  formError.value = ''
  workspace.saveProfile({
    name: draft.name.trim(),
    location: draft.location.trim(),
    bio: draft.bio.trim(),
    ratePence: Math.round(rate * 100),
    rateBasis: draft.rateBasis,
    acceptedPets: [...draft.acceptedPets],
    phone: draft.phone.trim(),
    services: draft.services.map(service => ({ ...service })),
  })
  saving.value = false
  toast.add({ title: 'Profile updated in preview', description: 'These changes are only held in this browser tab.', icon: 'i-lucide-circle-check', color: 'success' })
}
</script>

<template>
  <div class="mx-auto max-w-4xl">
    <div>
      <p class="text-sm font-semibold text-primary">Sitter workspace</p>
      <h1 class="mt-1 text-3xl font-semibold sm:text-4xl">Your sitter profile</h1>
      <p class="mt-2 max-w-2xl text-toned">Help invited bookers understand your care style, availability and costs.</p>
    </div>

    <UAlert
      class="mt-6"
      color="info"
      variant="subtle"
      icon="i-lucide-info"
      title="Private profile"
      description="This profile is intended for people invited to use Nesse. Your exact home address and booking-only instructions are not part of the profile."
    />

    <form class="mt-6 space-y-6" @submit.prevent="saveProfile">
      <UCard>
        <div class="flex flex-wrap items-start gap-4">
          <UAvatar :alt="draft.name" :text="draft.name.split(' ').map(part => part[0]).slice(0, 2).join('')" size="3xl" />
          <div class="min-w-0 flex-1">
            <h2 class="text-xl font-semibold">Profile basics</h2>
            <p class="mt-1 text-sm text-muted">Profile photos are not available yet because Nesse does not store images.</p>
            <div class="mt-5 grid gap-4 sm:grid-cols-2">
              <UFormField label="Name" name="name" required>
                <UInput v-model="draft.name" autocomplete="name" size="xl" class="w-full" />
              </UFormField>
              <UFormField label="Your area" name="location" required hint="Town or region only; do not enter your home address.">
                <UInput v-model="draft.location" autocomplete="address-level2" size="xl" class="w-full" />
              </UFormField>
              <UFormField label="Contact phone" name="phone" hint="Shared with bookers when relevant to a booking.">
                <UInput v-model="draft.phone" type="tel" autocomplete="tel" size="xl" class="w-full" />
              </UFormField>
            </div>
          </div>
        </div>
        <UFormField class="mt-5" label="About your approach" name="bio" required hint="A little about your experience and what makes a sit a good fit.">
          <UTextarea v-model="draft.bio" :rows="5" :maxlength="1000" class="w-full" />
        </UFormField>
      </UCard>

      <UCard>
        <h2 class="text-xl font-semibold">Rates and services</h2>
        <p class="mt-1 text-sm text-muted">Keep the rate basis and optional charges clear before a booking is confirmed.</p>
        <div class="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,0.8fr)]">
          <UFormField label="Base rate (£)" name="rate" required hint="Enter a rate in pounds; for example, 68.00.">
            <UInput v-model="draft.rate" type="number" inputmode="decimal" min="0.01" step="0.01" size="xl" class="w-full" />
          </UFormField>
          <UFormField label="Rate basis" name="rate-basis" required>
            <USelect
              v-model="draft.rateBasis"
              :items="[{ label: 'Per night', value: 'per_night' }, { label: 'Per day', value: 'per_day' }]"
              size="xl"
              class="w-full"
            />
          </UFormField>
        </div>

        <fieldset class="mt-5">
          <legend class="font-semibold">Pets you are comfortable caring for</legend>
          <p class="mt-1 text-sm text-muted">Select every type you may be able to care for.</p>
          <div class="mt-3 grid gap-2 sm:grid-cols-2">
            <label v-for="pet in petsOffered" :key="pet" class="flex min-h-11 items-center gap-3 rounded-lg border border-default px-3">
              <input v-model="draft.acceptedPets" type="checkbox" :value="pet" class="size-4 accent-primary">
              <span>{{ pet }}</span>
            </label>
          </div>
        </fieldset>

        <div class="mt-6 border-t border-default pt-5">
          <div class="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 class="font-semibold">Optional services</h3>
              <p class="mt-1 text-sm text-muted">Add services and prices that bookers can request.</p>
            </div>
          </div>
          <ul v-if="draft.services.length" class="mt-3 divide-y divide-default rounded-xl border border-default">
            <li v-for="service in draft.services" :key="service.id" class="flex flex-wrap items-center justify-between gap-3 p-3">
              <span class="min-w-0 font-semibold">{{ service.name }} <span class="font-normal text-muted">· {{ formatMoney(service.pricePence) }} per night</span></span>
              <UButton
                type="button"
                color="error"
                variant="ghost"
                icon="i-lucide-trash-2"
                :aria-label="`Remove ${service.name}`"
                @click="draft.services = draft.services.filter(item => item.id !== service.id)"
              />
            </li>
          </ul>
          <p v-else class="mt-3 rounded-lg border border-dashed border-default p-3 text-sm text-muted">No optional services added.</p>
          <div class="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:items-end">
            <UFormField label="Service name" name="service-name">
              <UInput v-model="serviceName" placeholder="e.g. Dog walking" size="xl" class="w-full" />
            </UFormField>
            <UFormField label="Price (£)" name="service-price">
              <UInput v-model="servicePrice" type="number" min="0" step="0.01" size="xl" class="w-full" />
            </UFormField>
            <UButton type="button" color="neutral" variant="outline" size="xl" icon="i-lucide-plus" @click="addService">Add service</UButton>
          </div>
        </div>
      </UCard>

      <div v-if="formError" role="alert" class="rounded-lg border border-error/30 bg-error/5 p-3 font-semibold text-error">{{ formError }}</div>
      <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <UButton to="/sitter" color="neutral" variant="outline" size="xl">Back to overview</UButton>
        <UButton type="submit" size="xl" icon="i-lucide-save" :loading="saving" :disabled="saving">Save profile changes</UButton>
      </div>
    </form>
  </div>
</template>
