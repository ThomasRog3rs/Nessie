<script setup lang="ts">
definePageMeta({ layout: 'sitter' })
useHead({ title: 'Booking requests · Nesse' })

const { bookings, updateStatus } = useSitterWorkspace()
const toast = useToast()
const filter = ref<'open' | 'all'>('open')
const declineOpen = ref(false)
const decliningId = ref('')
const declineReason = ref('')
const decisionError = ref('')

const requests = computed(() => bookings.value
  .filter(booking => ['requested', 'accepted_times_pending', 'declined'].includes(booking.status))
  .filter(booking => filter.value === 'all' || booking.status !== 'declined')
  .sort((a, b) => a.startDate.localeCompare(b.startDate)))

function statusLabel(status: string) {
  if (status === 'requested') return 'Awaiting your reply'
  if (status === 'accepted_times_pending') return 'Accepted · times to agree'
  if (status === 'declined') return 'Declined'
  return status
}

function accept(id: string) {
  updateStatus(id, 'accepted_times_pending')
  toast.add({
    title: 'Request accepted',
    description: 'Agree exact arrival and departure times to confirm the booking.',
    icon: 'i-lucide-circle-check',
    color: 'success',
  })
}

function openDecline(id: string) {
  decliningId.value = id
  declineReason.value = ''
  decisionError.value = ''
  declineOpen.value = true
}

function decline() {
  if (!decliningId.value) {
    decisionError.value = 'Choose a request before declining it.'
    return
  }
  updateStatus(decliningId.value, 'declined', declineReason.value.trim())
  declineOpen.value = false
  toast.add({ title: 'Request declined', description: 'The decision is recorded in this preview only.', icon: 'i-lucide-circle-x', color: 'neutral' })
}
</script>

<template>
  <div class="mx-auto max-w-5xl">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="text-sm font-semibold text-primary">Sitter workspace</p>
        <h1 class="mt-1 text-3xl font-semibold sm:text-4xl">Booking requests</h1>
        <p class="mt-2 max-w-2xl text-toned">Review the dates and care needs, then accept or decline. A request remains pending until you choose.</p>
      </div>
      <div class="inline-flex rounded-lg border border-default bg-elevated p-1" aria-label="Filter requests">
        <button
          type="button"
          class="min-h-10 rounded-md px-3 text-sm font-semibold transition-colors"
          :class="filter === 'open' ? 'bg-default text-primary shadow-sm' : 'text-toned hover:text-primary'"
          :aria-pressed="filter === 'open'"
          @click="filter = 'open'"
        >        Active requests</button>
        <button
          type="button"
          class="min-h-10 rounded-md px-3 text-sm font-semibold transition-colors"
          :class="filter === 'all' ? 'bg-default text-primary shadow-sm' : 'text-toned hover:text-primary'"
          :aria-pressed="filter === 'all'"
          @click="filter = 'all'"
        >All requests</button>
      </div>
    </div>

    <UAlert
      class="mt-6"
      color="info"
      variant="subtle"
      icon="i-lucide-info"
      title="Accepting is not the final confirmation"
      description="After accepting, agree the exact arrival and departure times on the booking. A request stays in its current state until you take an explicit action."
    />

    <ul v-if="requests.length" class="mt-6 space-y-4">
      <li v-for="booking in requests" :key="booking.id" class="rounded-2xl border border-default bg-default p-4 sm:p-6">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="flex min-w-0 items-start gap-3">
            <UAvatar :alt="booking.bookerName" :text="booking.bookerInitials" size="lg" />
            <div class="min-w-0">
              <h2 class="text-xl font-semibold">{{ booking.bookerName }}</h2>
              <p class="mt-1 text-toned">{{ formatDate(booking.startDate) }} – {{ formatDate(booking.endDate) }}</p>
              <p class="mt-1 text-sm text-muted">{{ booking.arrivalTime }} arrival · {{ booking.departureTime }} departure requested</p>
            </div>
          </div>
          <UBadge
            :color="booking.status === 'requested' ? 'warning' : booking.status === 'declined' ? 'neutral' : 'success'"
            variant="subtle"
            :icon="booking.status === 'requested' ? 'i-lucide-clock' : booking.status === 'declined' ? 'i-lucide-circle-x' : 'i-lucide-circle-check'"
            :label="statusLabel(booking.status)"
          />
        </div>

        <div class="mt-5 grid gap-5 border-t border-default pt-5 sm:grid-cols-2">
          <div>
            <h3 class="font-semibold">Pets and care</h3>
            <ul class="mt-2 space-y-2">
              <li v-for="pet in booking.pets" :key="pet.name">
                <p class="font-semibold">{{ pet.name }} <span class="font-normal text-muted">· {{ pet.species }}</span></p>
                <p v-if="pet.notes" class="text-sm text-toned">{{ pet.notes }}</p>
              </li>
            </ul>
            <p v-if="booking.careNotes" class="mt-3 whitespace-pre-line text-sm text-toned">{{ booking.careNotes }}</p>
          </div>
          <div>
            <h3 class="font-semibold">Proposed costs and services</h3>
            <ul class="mt-2 space-y-1 text-sm text-toned">
              <li v-for="service in booking.services" :key="service">{{ service }}</li>
              <li v-if="booking.requestedTravelPence">Travel reimbursement proposed: {{ formatMoney(booking.requestedTravelPence) }}</li>
              <li v-for="expense in booking.requestedIncidentals" :key="expense.description">
                {{ expense.description }}: {{ formatMoney(expense.amountPence) }}
              </li>
              <li v-if="!booking.services.length && !booking.requestedIncidentals.length && !booking.requestedTravelPence" class="text-muted">
                No additional services or expenses requested.
              </li>
            </ul>
            <p class="mt-3 text-xs text-muted">Amounts are proposed terms only. Payment is arranged outside Nesse.</p>
          </div>
        </div>

        <p v-if="booking.status === 'declined' && booking.declineReason" class="mt-4 rounded-lg bg-elevated p-3 text-sm text-toned">
          Your note: {{ booking.declineReason }}
        </p>

        <div class="mt-5 flex flex-col-reverse gap-2 border-t border-default pt-4 sm:flex-row sm:items-center sm:justify-between">
          <NuxtLink :to="`/sitter/bookings/${booking.id}`" class="inline-flex min-h-11 items-center gap-2 font-semibold text-primary hover:underline">
            View full request <UIcon name="i-lucide-arrow-right" class="size-4" aria-hidden="true" />
          </NuxtLink>
          <div v-if="booking.status === 'requested'" class="flex flex-col-reverse gap-2 sm:flex-row">
            <UButton color="error" variant="outline" size="lg" icon="i-lucide-circle-x" @click="openDecline(booking.id)">Decline</UButton>
            <UButton size="lg" icon="i-lucide-circle-check" @click="accept(booking.id)">Accept request</UButton>
          </div>
          <UButton v-else-if="booking.status === 'accepted_times_pending'" :to="`/sitter/bookings/${booking.id}`" size="lg" trailing-icon="i-lucide-arrow-right">
            Agree handover times
          </UButton>
        </div>
      </li>
    </ul>

    <div v-else class="mt-6 rounded-2xl border border-dashed border-default p-8 text-center sm:p-12">
      <span class="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary/5 text-primary">
        <UIcon name="i-lucide-inbox" class="size-6" aria-hidden="true" />
      </span>
      <h2 class="mt-4 text-xl font-semibold">{{ filter === 'open' ? 'No active requests' : 'No requests yet' }}</h2>
      <p class="mx-auto mt-2 max-w-md text-muted">{{ filter === 'open' ? 'You’re up to date. New requests will appear here.' : 'Your requests will appear here when a booker sends one.' }}</p>
    </div>

    <UModal v-model:open="declineOpen" title="Decline this request?" description="The booker will see that you declined. The decision will be recorded in this preview only.">
      <template #body>
        <UFormField label="Note to the booker (optional)" name="decline-reason" hint="For example, you are unavailable for these dates.">
          <UTextarea v-model="declineReason" :rows="3" class="w-full" />
        </UFormField>
        <p v-if="decisionError" class="mt-3 text-sm font-semibold text-error" role="alert">{{ decisionError }}</p>
      </template>
      <template #footer>
        <div class="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <UButton color="neutral" variant="outline" size="lg" @click="declineOpen = false">Keep request open</UButton>
          <UButton color="error" size="lg" icon="i-lucide-circle-x" @click="decline">Decline request</UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
