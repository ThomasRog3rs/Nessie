<script setup lang="ts">
const route = useRoute()
const api = useBookingApi()
const toast = useToast()
const id = route.params.id as string

const { data: booking, error, refresh } = await useAsyncData(`booking-${id}`, () => api.getBooking(id))
useHead({ title: 'Booking · Nesse' })

const nights = computed(() => booking.value ? nightsBetween(booking.value.startDate, booking.value.endDate) : 0)
const meta = computed(() => booking.value ? BOOKING_STATUS_META[booking.value.status] : undefined)
const canCancel = computed(() => booking.value && ['requested', 'accepted_times_pending', 'confirmed'].includes(booking.value.status))
const timesAgreed = computed(() => booking.value?.status === 'confirmed' || booking.value?.status === 'completed')

const costRows = computed(() => {
  const b = booking.value
  if (!b) return []
  const rows = [{ label: `Sitting (${nights.value} × ${formatMoney(b.rate)})`, amount: nights.value * b.rate }]
  rows.push({ label: 'Travel reimbursement', amount: b.travelReimbursement.amount })
  for (const e of b.incidentalExpenses) rows.push({ label: `Incidental: ${e.description}`, amount: e.amount })
  return rows
})

const cancelOpen = ref(false)
const reason = ref('')
const cancelling = ref(false)
const cancelError = ref<string>()

async function cancel() {
  cancelling.value = true
  cancelError.value = undefined
  try {
    booking.value = await api.cancelBooking(id, { reason: reason.value })
    cancelOpen.value = false
    toast.add({ title: 'Booking cancelled', description: 'The sitter will be notified.', icon: 'i-lucide-ban', color: 'neutral' })
  }
  catch (e) {
    cancelError.value = apiErrorMessage(e)
  }
  finally {
    cancelling.value = false
  }
}
</script>

<template>
  <div>
    <UButton to="/bookings" color="neutral" variant="link" icon="i-lucide-arrow-left" class="mb-4 px-0">All bookings</UButton>

    <UAlert
      v-if="error || !booking"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      title="We couldn't find this booking"
      :actions="[{ label: 'Try again', color: 'error', variant: 'outline', onClick: () => refresh() }]"
    />

    <template v-else>
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 class="text-3xl font-semibold">
            {{ formatDate(booking.startDate, { day: 'numeric', month: 'short' }) }} – {{ formatDate(booking.endDate, { day: 'numeric', month: 'short', year: 'numeric' }) }}
          </h1>
          <p class="mt-1 text-muted">{{ nights }} {{ nights === 1 ? 'night' : 'nights' }} with {{ booking.sitterName }}</p>
        </div>
        <BookingStatusBadge :status="booking.status" />
      </div>
      <p class="mt-3 max-w-prose text-toned" role="status">{{ meta?.description }}</p>

      <div class="mt-6 grid gap-6 lg:grid-cols-2">
        <UCard>
          <h2 class="text-lg font-semibold">Handover times</h2>
          <dl class="mt-3 space-y-3">
            <div>
              <dt class="text-sm text-muted">Arrive</dt>
              <dd class="font-semibold">{{ formatDate(booking.startDate) }} · {{ booking.arrivalTime }}</dd>
            </div>
            <div>
              <dt class="text-sm text-muted">Depart</dt>
              <dd class="font-semibold">{{ formatDate(booking.endDate) }} · {{ booking.departureTime }}</dd>
            </div>
          </dl>
          <p class="mt-3 text-sm" :class="timesAgreed ? 'text-success' : 'text-warning'">
            <UIcon :name="timesAgreed ? 'i-lucide-circle-check' : 'i-lucide-clock'" class="mr-1 inline size-4 align-text-bottom" aria-hidden="true" />
            {{ timesAgreed ? 'Agreed times' : 'Requested times – not yet agreed' }} · {{ booking.timezone.replace('_', ' ') }}
          </p>
        </UCard>

        <UCard>
          <h2 class="text-lg font-semibold">Costs</h2>
          <dl class="mt-3 space-y-2">
            <div v-for="(r, i) in costRows" :key="i" class="flex justify-between gap-4">
              <dt>{{ r.label }}</dt><dd class="font-semibold">{{ formatMoney(r.amount) }}</dd>
            </div>
          </dl>
          <p v-if="booking.travelReimbursement.notes" class="mt-2 text-sm text-muted">Travel: {{ booking.travelReimbursement.notes }}</p>
          <p class="mt-3 text-sm text-muted">Recorded terms only; payment happens outside Nesse.</p>
        </UCard>

        <UCard>
          <h2 class="text-lg font-semibold">Pets and care</h2>
          <ul class="mt-3 space-y-2">
            <li v-for="(p, i) in booking.pets" :key="i">
              <span class="font-semibold">{{ p.name }}</span> <span class="text-muted">({{ p.species }})</span>
              <p v-if="p.notes" class="text-toned">{{ p.notes }}</p>
            </li>
          </ul>
          <p v-if="booking.careNotes" class="mt-3 whitespace-pre-line text-toned">{{ booking.careNotes }}</p>
        </UCard>

        <UCard>
          <h2 class="text-lg font-semibold">Emergency details</h2>
          <p class="mt-3">
            <span class="font-semibold">{{ booking.emergencyContact.name }}</span>
            <span v-if="booking.emergencyContact.relationship" class="text-muted"> ({{ booking.emergencyContact.relationship }})</span><br>
            {{ booking.emergencyContact.phone }}
          </p>
          <p v-if="booking.vet.name" class="mt-2">Vet: {{ booking.vet.name }} {{ booking.vet.phone }}</p>
          <p v-if="booking.emergencyInstructions" class="mt-2 whitespace-pre-line text-toned">{{ booking.emergencyInstructions }}</p>
        </UCard>
      </div>

      <section aria-labelledby="history-h" class="mt-10">
        <h2 id="history-h" class="text-xl font-semibold">History</h2>
        <ol class="mt-4 space-y-4 border-l-2 border-default pl-5">
          <li v-for="h in [...booking.history].reverse()" :key="h.id" class="relative">
            <span class="absolute -left-[1.6rem] top-2 size-3 rounded-full bg-primary" aria-hidden="true" />
            <p class="text-sm text-muted"><time :datetime="h.at">{{ formatInstant(h.at, booking.timezone) }}</time> · {{ h.actor === 'booker' ? 'You' : booking.sitterName }}</p>
            <p>{{ h.message }}</p>
          </li>
        </ol>
      </section>

      <div v-if="canCancel" class="mt-10 border-t border-default pt-6">
        <UModal v-model:open="cancelOpen" title="Cancel this booking?" description="Your sitter will be notified and the cancellation recorded in the booking history. This can't be undone.">
          <UButton color="error" variant="outline" size="lg" icon="i-lucide-ban">Cancel booking</UButton>
          <template #body>
            <UFormField label="Reason (optional)" name="reason">
              <UTextarea v-model="reason" :rows="3" class="w-full" />
            </UFormField>
            <p v-if="cancelError" role="alert" class="mt-3 font-semibold text-error">{{ cancelError }}</p>
          </template>
          <template #footer>
            <div class="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <UButton color="neutral" variant="outline" size="lg" @click="cancelOpen = false">Keep booking</UButton>
              <UButton color="error" size="lg" :loading="cancelling" @click="cancel">Yes, cancel booking</UButton>
            </div>
          </template>
        </UModal>
      </div>
    </template>
  </div>
</template>
