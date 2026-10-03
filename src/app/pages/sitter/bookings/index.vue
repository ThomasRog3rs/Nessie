<script setup lang="ts">
definePageMeta({ layout: 'sitter' })
useHead({ title: 'Sitter bookings · Nesse' })

const { bookings } = useSitterWorkspace()
const filter = ref<'upcoming' | 'past' | 'all'>('upcoming')
const today = new Date().toISOString().slice(0, 10)

const visibleBookings = computed(() => bookings.value
  .filter(booking => {
    if (filter.value === 'upcoming') return booking.endDate >= today && !['declined', 'cancelled', 'completed'].includes(booking.status)
    if (filter.value === 'past') return booking.endDate < today || ['declined', 'cancelled', 'completed'].includes(booking.status)
    return true
  })
  .sort((a, b) => a.startDate.localeCompare(b.startDate)))

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    requested: 'Awaiting your reply',
    accepted_times_pending: 'Times to agree',
    confirmed: 'Confirmed',
    declined: 'Declined',
    cancelled: 'Cancelled',
    completed: 'Completed',
  }
  return labels[status] ?? status
}

function statusColor(status: string) {
  if (status === 'confirmed' || status === 'completed') return 'success'
  if (status === 'requested' || status === 'accepted_times_pending') return 'warning'
  if (status === 'declined' || status === 'cancelled') return 'error'
  return 'neutral'
}
</script>

<template>
  <div class="mx-auto max-w-5xl">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="text-sm font-semibold text-primary">Sitter workspace</p>
        <h1 class="mt-1 text-3xl font-semibold sm:text-4xl">Bookings</h1>
        <p class="mt-2 max-w-2xl text-toned">Keep requests, agreed handover times and care details together for each stay.</p>
      </div>
      <div class="inline-flex flex-wrap rounded-lg border border-default bg-elevated p-1" aria-label="Filter bookings">
        <button
          v-for="option in [{ key: 'upcoming', label: 'Upcoming' }, { key: 'past', label: 'Past' }, { key: 'all', label: 'All' }]"
          :key="option.key"
          type="button"
          class="min-h-10 rounded-md px-3 text-sm font-semibold transition-colors"
          :class="filter === option.key ? 'bg-default text-primary shadow-sm' : 'text-toned hover:text-primary'"
          :aria-pressed="filter === option.key"
          @click="filter = option.key as 'upcoming' | 'past' | 'all'"
        >{{ option.label }}</button>
      </div>
    </div>

    <UAlert
      class="mt-6"
      color="info"
      variant="subtle"
      icon="i-lucide-info"
      title="Only confirmed times are an agreement"
      description="Requested arrival and departure times stay clearly marked until both people agree exact handover times."
    />

    <ul v-if="visibleBookings.length" class="mt-6 space-y-3">
      <li v-for="booking in visibleBookings" :key="booking.id">
        <NuxtLink
          :to="`/sitter/bookings/${booking.id}`"
          class="block rounded-xl border border-default bg-default p-4 transition-colors hover:border-primary/40 sm:p-5"
        >
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="flex min-w-0 items-start gap-3">
              <UAvatar :alt="booking.bookerName" :text="booking.bookerInitials" size="lg" />
              <div class="min-w-0">
                <p class="font-semibold">{{ booking.bookerName }}</p>
                <p class="mt-1 font-display text-lg font-semibold text-primary">{{ formatDate(booking.startDate) }} – {{ formatDate(booking.endDate) }}</p>
                <p class="mt-1 text-sm text-toned">{{ booking.arrivalTime }} arrival · {{ booking.departureTime }} departure <span v-if="booking.status !== 'confirmed' && booking.status !== 'completed'">(requested)</span></p>
              </div>
            </div>
            <UBadge :color="statusColor(booking.status)" variant="subtle" :label="statusLabel(booking.status)" />
          </div>
          <div class="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-default pt-3 text-sm text-muted">
            <span>{{ booking.pets.map(pet => `${pet.name} · ${pet.species}`).join(', ') }}</span>
            <span class="inline-flex items-center gap-1 font-semibold text-primary">Open booking <UIcon name="i-lucide-arrow-right" class="size-4" aria-hidden="true" /></span>
          </div>
        </NuxtLink>
      </li>
    </ul>

    <div v-else class="mt-6 rounded-2xl border border-dashed border-default p-8 text-center sm:p-12">
      <span class="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary/5 text-primary">
        <UIcon name="i-lucide-calendar-check" class="size-6" aria-hidden="true" />
      </span>
      <h2 class="mt-4 text-xl font-semibold">No {{ filter === 'all' ? '' : filter }} bookings</h2>
      <p class="mx-auto mt-2 max-w-md text-muted">Requests and accepted sits will be listed here as they move through the booking process.</p>
    </div>
  </div>
</template>
