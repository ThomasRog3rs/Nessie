<script setup lang="ts">
useHead({ title: 'Review request · Nesse' })

const api = useBookingApi()
const draft = useBookingDraftStore()
const toast = useToast()

if (!draft.hasDates) await navigateTo('/book')

const { data: sitter } = await useAsyncData('sitter', () => api.getSitter())

const request = computed(() => (sitter.value ? draft.toRequest(sitter.value.id) : undefined))
const services = computed(() =>
  (sitter.value?.optionalServices ?? []).filter(s => draft.optionalServiceIds.includes(s.id)))

const totals = computed(() => {
  const r = request.value
  if (!r || !sitter.value) return undefined
  return calculatePricing({
    nights: draft.nights,
    rate: sitter.value.rate,
    services: services.value,
    travelAmount: r.travelReimbursement.amount,
    incidentalExpenses: r.incidentalExpenses,
  })
})

const submitting = ref(false)
const error = ref<string>()

async function submit() {
  if (!request.value || submitting.value) return
  submitting.value = true
  error.value = undefined
  try {
    const booking = await api.createBooking(request.value)
    clearNuxtData(['bookings', 'availability'])
    toast.add({ title: 'Request sent', description: 'Your sitter has been asked to accept or decline.', icon: 'i-lucide-circle-check', color: 'success' })
    await navigateTo(`/bookings/${booking.id}`)
    draft.$reset()
  }
  catch (e) {
    error.value = apiErrorMessage(e)
    // Someone else may have taken the dates; reload availability on the date step.
    if (isConflictError(e)) clearNuxtData('availability')
    document.getElementById('submit-error')?.focus()
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <div v-if="sitter && request && totals">
    <BookingSteps :current="3" />
    <h1 class="text-3xl font-semibold">Review your request</h1>
    <p class="mt-2 max-w-prose text-muted">Nothing is booked until {{ sitter.name }} accepts. Staying silent never changes the status of a request.</p>

    <UAlert
      v-if="error"
      id="submit-error"
      tabindex="-1"
      class="mt-6"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="We couldn't send your request"
      :description="error"
      role="alert"
    />

    <div class="mt-6 grid gap-6 lg:grid-cols-2">
      <UCard>
        <h2 class="text-lg font-semibold">Dates and times</h2>
        <dl class="mt-3 space-y-3">
          <div>
            <dt class="text-sm text-muted">Arrive</dt>
            <dd class="font-semibold">{{ formatDate(request.startDate) }} · {{ request.arrivalTime }} <span class="font-normal text-muted">(requested)</span></dd>
          </div>
          <div>
            <dt class="text-sm text-muted">Depart</dt>
            <dd class="font-semibold">{{ formatDate(request.endDate) }} · {{ request.departureTime }} <span class="font-normal text-muted">(requested)</span></dd>
          </div>
          <div>
            <dt class="text-sm text-muted">Sitter</dt>
            <dd class="font-semibold">{{ sitter.name }}</dd>
          </div>
        </dl>
        <UButton to="/book" color="neutral" variant="link" class="mt-3 px-0">Change dates</UButton>
      </UCard>

      <UCard>
        <h2 class="text-lg font-semibold">Agreed costs</h2>
        <dl class="mt-3 space-y-2">
          <div class="flex justify-between gap-4"><dt>Sitting ({{ draft.nights }} × {{ formatMoney(sitter.rate) }})</dt><dd class="font-semibold">{{ formatMoney(totals.sitting) }}</dd></div>
          <div v-for="s in services" :key="s.id" class="flex justify-between gap-4"><dt>{{ s.name }} ({{ draft.nights }} × {{ formatMoney(s.price) }})</dt><dd class="font-semibold">{{ formatMoney(s.price * draft.nights) }}</dd></div>
          <div class="flex justify-between gap-4"><dt>Travel reimbursement</dt><dd class="font-semibold">{{ formatMoney(totals.travel) }}</dd></div>
          <div v-for="(e, i) in request.incidentalExpenses" :key="i" class="flex justify-between gap-4"><dt>{{ e.description }}</dt><dd class="font-semibold">{{ formatMoney(e.amount) }}</dd></div>
        </dl>
        <p class="mt-3 text-sm text-muted">Nesse records these terms only. Payment is arranged outside the app.</p>
      </UCard>

      <UCard>
        <h2 class="text-lg font-semibold">Pets</h2>
        <ul class="mt-3 space-y-2">
          <li v-for="(p, i) in request.pets" :key="i">
            <span class="font-semibold">{{ p.name }}</span> <span class="text-muted">({{ p.species }})</span>
            <p v-if="p.notes" class="text-toned">{{ p.notes }}</p>
          </li>
        </ul>
        <template v-if="request.careNotes">
          <h3 class="mt-4 font-semibold">Care needs</h3>
          <p class="whitespace-pre-line text-toned">{{ request.careNotes }}</p>
        </template>
      </UCard>

      <UCard>
        <h2 class="text-lg font-semibold">Emergency details</h2>
        <p class="mt-3">
          <span class="font-semibold">{{ request.emergencyContact.name }}</span>
          <span v-if="request.emergencyContact.relationship" class="text-muted"> ({{ request.emergencyContact.relationship }})</span><br>
          {{ request.emergencyContact.phone }}
        </p>
        <p v-if="request.vet.name" class="mt-2">Vet: {{ request.vet.name }} {{ request.vet.phone }}</p>
        <p v-if="request.emergencyInstructions" class="mt-2 whitespace-pre-line text-toned">{{ request.emergencyInstructions }}</p>
      </UCard>
    </div>

    <UCard class="mt-6">
      <UCheckbox
        v-model="draft.cancellationTermAcknowledged"
        label="I acknowledge the 72-hour cancellation term (optional)"
        description="If the sitter cancels within 72 hours of the agreed start, they may be responsible for the agreed cost of alternative care. Nesse records this term but does not enforce it or collect any payment."
        size="lg"
      />
    </UCard>

    <div class="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
      <UButton to="/book/details" size="xl" color="neutral" variant="outline" icon="i-lucide-arrow-left">Back to details</UButton>
      <UButton size="xl" :loading="submitting" :disabled="submitting" trailing-icon="i-lucide-send" @click="submit">
        {{ submitting ? 'Sending request…' : 'Send booking request' }}
      </UButton>
    </div>
  </div>
</template>
