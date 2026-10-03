<script setup lang="ts">
definePageMeta({ layout: 'sitter' })
useHead({ title: 'Sitter overview · Nesse' })

const { profile, bookings, pendingRequests, upcomingBookings, unavailableBlocks } = useSitterWorkspace()
const nextBooking = computed(() => upcomingBookings.value.find(booking => booking.status === 'confirmed'))
const completedProfileFields = computed(() => [
  profile.value.name,
  profile.value.location,
  profile.value.bio,
  profile.value.ratePence > 0 ? 'rate' : '',
  profile.value.acceptedPets.length ? 'pets' : '',
].filter(Boolean).length)
const profileCompletion = computed(() => Math.round(completedProfileFields.value / 5 * 100))
</script>

<template>
  <div class="mx-auto max-w-5xl">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="text-sm font-semibold text-primary">Sitter workspace</p>
        <h1 class="mt-1 text-3xl font-semibold sm:text-4xl">Good to see you, {{ profile.name.split(' ')[0] }}</h1>
        <p class="mt-2 max-w-2xl text-toned">A clear view of the sits, requests and care details that need your attention.</p>
      </div>
      <NuxtLink to="/sitter/profile" class="inline-flex min-h-11 items-center gap-2 rounded-lg border border-default bg-default px-4 font-semibold text-toned transition-colors hover:border-primary/40 hover:text-primary">
        <UIcon name="i-lucide-user-round-pen" class="size-5" aria-hidden="true" />
        Edit profile
      </NuxtLink>
    </div>

    <UAlert
      class="mt-6"
      color="info"
      variant="subtle"
      icon="i-lucide-flask-conical"
      title="Sitter preview"
      description="This is a front-end preview. Changes are held in this tab only; profile edits and files are not sent to a server."
    />

    <section aria-label="At a glance" class="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <NuxtLink to="/sitter/requests" class="rounded-xl border border-default bg-default p-5 transition-colors hover:border-primary/40">
        <span class="flex items-center justify-between gap-2 text-sm font-semibold text-muted">
          New requests <UIcon name="i-lucide-inbox" class="size-5 text-primary" aria-hidden="true" />
        </span>
        <span class="mt-3 block font-display text-3xl font-semibold text-primary">{{ pendingRequests.length }}</span>
        <span class="mt-1 block text-sm text-toned">Waiting for your decision</span>
      </NuxtLink>
      <NuxtLink to="/sitter/bookings" class="rounded-xl border border-default bg-default p-5 transition-colors hover:border-primary/40">
        <span class="flex items-center justify-between gap-2 text-sm font-semibold text-muted">
          Upcoming bookings <UIcon name="i-lucide-calendar-check" class="size-5 text-primary" aria-hidden="true" />
        </span>
        <span class="mt-3 block font-display text-3xl font-semibold text-primary">{{ upcomingBookings.length }}</span>
        <span class="mt-1 block text-sm text-toned">Accepted or confirmed</span>
      </NuxtLink>
      <NuxtLink to="/sitter/availability" class="rounded-xl border border-default bg-default p-5 transition-colors hover:border-primary/40">
        <span class="flex items-center justify-between gap-2 text-sm font-semibold text-muted">
          Unavailable dates <UIcon name="i-lucide-calendar-off" class="size-5 text-primary" aria-hidden="true" />
        </span>
        <span class="mt-3 block font-display text-3xl font-semibold text-primary">{{ unavailableBlocks.length }}</span>
        <span class="mt-1 block text-sm text-toned">Personal dates blocked out</span>
      </NuxtLink>
      <NuxtLink to="/sitter/profile" class="rounded-xl border border-default bg-default p-5 transition-colors hover:border-primary/40">
        <span class="flex items-center justify-between gap-2 text-sm font-semibold text-muted">
          Profile ready <UIcon name="i-lucide-badge-check" class="size-5 text-primary" aria-hidden="true" />
        </span>
        <span class="mt-3 block font-display text-3xl font-semibold text-primary">{{ profileCompletion }}%</span>
        <span class="mt-1 block text-sm text-toned">Make your profile useful to bookers</span>
      </NuxtLink>
    </section>

    <div class="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.8fr)]">
      <section aria-labelledby="attention-heading">
        <div class="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="attention-heading" class="text-2xl font-semibold">Needs your attention</h2>
            <p class="mt-1 text-muted">New requests stay open until you accept or decline.</p>
          </div>
          <NuxtLink to="/sitter/requests" class="inline-flex min-h-11 items-center gap-1 font-semibold text-primary hover:underline">
            All requests <UIcon name="i-lucide-arrow-right" class="size-4" aria-hidden="true" />
          </NuxtLink>
        </div>
        <div v-if="pendingRequests.length" class="mt-4 space-y-3">
          <NuxtLink
            v-for="booking in pendingRequests.slice(0, 2)"
            :key="booking.id"
            :to="`/sitter/bookings/${booking.id}`"
            class="block rounded-xl border border-default bg-default p-4 transition-colors hover:border-primary/40 sm:p-5"
          >
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div class="flex min-w-0 items-start gap-3">
                <UAvatar :alt="booking.bookerName" :text="booking.bookerInitials" size="lg" />
                <div class="min-w-0">
                  <p class="font-semibold text-default">{{ booking.bookerName }}</p>
                  <p class="mt-1 text-sm text-toned">{{ formatDate(booking.startDate) }} – {{ formatDate(booking.endDate) }}</p>
                </div>
              </div>
              <UBadge color="warning" variant="subtle" icon="i-lucide-clock" label="Awaiting your reply" />
            </div>
            <p class="mt-3 text-sm text-muted">{{ booking.pets.map(pet => `${pet.name} · ${pet.species}`).join(' and ') }}</p>
          </NuxtLink>
        </div>
        <div v-else class="mt-4 rounded-xl border border-dashed border-default p-6">
          <p class="font-semibold">You’re all caught up</p>
          <p class="mt-1 text-sm text-muted">New booking requests will appear here.</p>
        </div>
      </section>

      <section aria-labelledby="next-sit-heading">
        <h2 id="next-sit-heading" class="text-2xl font-semibold">Next confirmed sit</h2>
        <NuxtLink
          v-if="nextBooking"
          :to="`/sitter/bookings/${nextBooking.id}`"
          class="mt-4 block rounded-xl border border-default bg-primary/5 p-5 transition-colors hover:border-primary/40"
        >
          <p class="text-sm font-semibold text-primary">{{ formatDate(nextBooking.startDate) }} – {{ formatDate(nextBooking.endDate) }}</p>
          <p class="mt-2 font-display text-xl font-semibold text-default">{{ nextBooking.bookerName }}</p>
          <p class="mt-2 text-sm text-toned">{{ nextBooking.pets.map(pet => pet.name).join(' and ') }}</p>
          <p class="mt-4 flex items-center gap-2 text-sm font-semibold text-primary">
            View care details <UIcon name="i-lucide-arrow-right" class="size-4" aria-hidden="true" />
          </p>
        </NuxtLink>
        <div v-else class="mt-4 rounded-xl border border-dashed border-default p-6">
          <p class="font-semibold">No upcoming confirmed sits</p>
          <p class="mt-1 text-sm text-muted">Once you agree the booking details, it will show here.</p>
        </div>

        <div class="mt-4 rounded-xl border border-default bg-default p-5">
          <div class="flex items-start gap-3">
            <span class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary/10 text-secondary">
              <UIcon name="i-lucide-shield-check" class="size-5" aria-hidden="true" />
            </span>
            <div>
              <h3 class="font-semibold">Keep details in one place</h3>
              <p class="mt-1 text-sm text-toned">Confirmed times, care notes, expenses and updates belong on the booking record. An update is not proof of attendance.</p>
            </div>
          </div>
        </div>
      </section>
    </div>

    <section aria-labelledby="other-bookings-heading" class="mt-9">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="other-bookings-heading" class="text-2xl font-semibold">Your other bookings</h2>
          <p class="mt-1 text-muted">Accepted stays and recently completed care.</p>
        </div>
        <NuxtLink to="/sitter/bookings" class="inline-flex min-h-11 items-center gap-1 font-semibold text-primary hover:underline">
          View bookings <UIcon name="i-lucide-arrow-right" class="size-4" aria-hidden="true" />
        </NuxtLink>
      </div>
      <p class="mt-3 text-sm text-muted">{{ bookings.length }} sample bookings in this preview.</p>
    </section>
  </div>
</template>
