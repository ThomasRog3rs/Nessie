<script setup lang="ts">
useHead({ title: 'My bookings · Nesse' })

const api = useBookingApi()
const { data: bookings, status, error, refresh } = await useAsyncData('bookings', () => api.listBookings(), { lazy: true })
</script>

<template>
  <div>
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-3xl font-semibold">My bookings</h1>
      <UButton to="/book" size="lg" icon="i-lucide-calendar-plus">New booking</UButton>
    </div>

    <div class="mt-6" :aria-busy="status === 'pending'">
      <div v-if="status === 'pending'" class="space-y-3">
        <USkeleton v-for="n in 3" :key="n" class="h-28 w-full" />
      </div>

      <UAlert
        v-else-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        title="We couldn't load your bookings"
        description="Check your connection and try again."
        :actions="[{ label: 'Try again', color: 'error', variant: 'outline', onClick: () => refresh() }]"
      />

      <div v-else-if="!bookings?.length" class="rounded-xl border border-dashed border-accented p-10 text-center">
        <UIcon name="i-lucide-calendar-days" class="mx-auto size-10 text-muted" aria-hidden="true" />
        <h2 class="mt-3 text-xl font-semibold">No bookings yet</h2>
        <p class="mt-1 text-muted">Choose your dates to send your first request.</p>
        <UButton to="/book" size="xl" class="mt-5">Choose dates</UButton>
      </div>

      <ul v-else class="space-y-3">
        <li v-for="b in bookings" :key="b.id">
          <NuxtLink
            :to="`/bookings/${b.id}`"
            class="block rounded-xl border border-default bg-default p-4 transition-colors duration-200 hover:border-primary/50 sm:p-5"
          >
            <div class="flex flex-wrap items-start justify-between gap-2">
              <p class="font-display text-lg font-semibold text-primary">
                {{ formatDate(b.startDate, { day: 'numeric', month: 'short' }) }} – {{ formatDate(b.endDate, { day: 'numeric', month: 'short', year: 'numeric' }) }}
              </p>
              <BookingStatusBadge :status="b.status" />
            </div>
            <p class="mt-1 text-toned">
              {{ nightsBetween(b.startDate, b.endDate) }} nights with {{ b.sitterName }} ·
              {{ b.arrivalTime }} → {{ b.departureTime }} <span class="text-muted">(requested)</span>
            </p>
            <p class="mt-1 text-sm text-muted">{{ b.pets.map(p => p.name).join(', ') }}</p>
          </NuxtLink>
        </li>
      </ul>
    </div>
  </div>
</template>
