<script setup lang="ts">
import { addDays } from '#shared/utils/dateRange'

definePageMeta({ layout: 'sitter' })
useHead({ title: 'Sitter availability · Nesse' })

const { bookings, unavailableBlocks, addUnavailableBlock, removeUnavailableBlock } = useSitterWorkspace()
const toast = useToast()
const today = new Date().toISOString().slice(0, 10)
const startDate = ref('')
const endDate = ref('')
const reason = ref('')
const formError = ref('')

const scheduledBookings = computed(() => bookings.value
  .filter(booking => ['requested', 'accepted_times_pending', 'confirmed'].includes(booking.status) && booking.endDate >= today)
  .sort((a, b) => a.startDate.localeCompare(b.startDate)))

function overlapsBooking(start: string, end: string) {
  const exclusiveEnd = addDays(end, 1)
  return scheduledBookings.value.find(booking => booking.startDate < exclusiveEnd && booking.endDate > start)
}

async function addBlock() {
  formError.value = ''
  if (!startDate.value || !endDate.value || !reason.value.trim()) {
    formError.value = 'Choose both dates and add a short reason.'
    return
  }
  if (endDate.value < startDate.value) {
    formError.value = 'The end date must be on or after the start date.'
    return
  }
  const clash = overlapsBooking(startDate.value, endDate.value)
  if (clash) {
    formError.value = `These dates overlap with ${clash.bookerName}’s booking (${formatDate(clash.startDate)} – ${formatDate(clash.endDate)}). Choose different dates.`
    return
  }
  const duplicate = unavailableBlocks.value.find(block => startDate.value <= block.endDate && endDate.value >= block.startDate)
  if (duplicate) {
    formError.value = `These dates overlap with an existing unavailable period (${formatDate(duplicate.startDate)} – ${formatDate(duplicate.endDate)}).`
    return
  }
  try {
    await addUnavailableBlock({
      startDate: startDate.value,
      endDate: endDate.value,
      reason: reason.value.trim(),
    })
  }
  catch (error) {
    formError.value = error instanceof Error ? error.message : 'These dates could not be blocked.'
    return
  }
  startDate.value = ''
  endDate.value = ''
  reason.value = ''
  toast.add({ title: 'Dates blocked', icon: 'i-lucide-calendar-off', color: 'success' })
}

async function removeBlock(id: string) {
  try {
    await removeUnavailableBlock(id)
    toast.add({ title: 'Unavailable dates removed', icon: 'i-lucide-circle-check', color: 'neutral' })
  }
  catch (error) {
    formError.value = error instanceof Error ? error.message : 'The unavailable dates could not be removed.'
  }
}
</script>

<template>
  <div class="mx-auto max-w-5xl">
    <div>
      <p class="text-sm font-semibold text-primary">Sitter workspace</p>
      <h1 class="mt-1 text-3xl font-semibold sm:text-4xl">Your availability</h1>
      <p class="mt-2 max-w-2xl text-toned">Block out time you cannot sit and check upcoming stays before you agree to new dates.</p>
    </div>

    <UAlert
      class="mt-6"
      color="info"
      variant="subtle"
      icon="i-lucide-calendar-clock"
      title="Availability is not a booking"
      description="Unavailable periods and confirmed bookings are shown separately. Adding a block will not cancel or change an existing booking."
    />

    <div class="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)]">
      <UCard>
        <h2 class="text-xl font-semibold">Block unavailable dates</h2>
        <p class="mt-1 text-sm text-muted">The start and end dates are both included.</p>
        <form class="mt-5 space-y-4" @submit.prevent="addBlock">
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField label="From" name="block-start" required>
              <UInput v-model="startDate" type="date" :min="today" size="xl" class="w-full" />
            </UFormField>
            <UFormField label="Through" name="block-end" required>
              <UInput v-model="endDate" type="date" :min="startDate || today" size="xl" class="w-full" />
            </UFormField>
          </div>
          <UFormField label="Reason" name="block-reason" required hint="A short private note for your own reference.">
            <UInput v-model="reason" maxlength="200" placeholder="e.g. Personal plans" size="xl" class="w-full" />
          </UFormField>
          <p v-if="formError" class="text-sm font-semibold text-error" role="alert">{{ formError }}</p>
          <UButton type="submit" size="xl" icon="i-lucide-calendar-plus">Block these dates</UButton>
        </form>
      </UCard>

      <section aria-labelledby="blocked-heading">
        <h2 id="blocked-heading" class="text-xl font-semibold">Unavailable periods</h2>
        <p class="mt-1 text-sm text-muted">These dates are not open for requests.</p>
        <ul v-if="unavailableBlocks.length" class="mt-4 space-y-3">
          <li v-for="block in [...unavailableBlocks].sort((a, b) => a.startDate.localeCompare(b.startDate))" :key="block.id" class="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-default bg-default p-4">
            <div>
              <p class="font-semibold">{{ formatDate(block.startDate) }} – {{ formatDate(block.endDate) }}</p>
              <p class="mt-1 text-sm text-toned">{{ block.reason }}</p>
              <UBadge class="mt-2" color="neutral" variant="subtle" icon="i-lucide-calendar-off" label="Unavailable" />
            </div>
            <UButton color="neutral" variant="ghost" icon="i-lucide-trash-2" :aria-label="`Remove unavailable dates ${formatDate(block.startDate)} to ${formatDate(block.endDate)}`" @click="removeBlock(block.id)" />
          </li>
        </ul>
        <div v-else class="mt-4 rounded-xl border border-dashed border-default p-5">
          <p class="font-semibold">No unavailable dates</p>
          <p class="mt-1 text-sm text-muted">Add a period when you cannot accept a sit.</p>
        </div>
      </section>
    </div>

    <section aria-labelledby="upcoming-heading" class="mt-8">
      <h2 id="upcoming-heading" class="text-xl font-semibold">Upcoming bookings</h2>
      <p class="mt-1 text-sm text-muted">Accepted stays and confirmed bookings are not the same as open availability.</p>
      <ul v-if="scheduledBookings.length" class="mt-4 grid gap-3 sm:grid-cols-2">
        <li v-for="booking in scheduledBookings" :key="booking.id">
          <NuxtLink :to="`/sitter/bookings/${booking.id}`" class="block rounded-xl border border-default bg-primary/5 p-4 transition-colors hover:border-primary/40">
            <p class="text-sm font-semibold text-primary">{{ formatDate(booking.startDate) }} – {{ formatDate(booking.endDate) }}</p>
            <p class="mt-1 font-semibold">{{ booking.bookerName }}</p>
            <p class="mt-1 text-sm text-toned">
              {{ booking.status === 'confirmed' ? 'Confirmed booking' : booking.status === 'requested' ? 'Request pending' : 'Accepted · handover times to agree' }}
            </p>
          </NuxtLink>
        </li>
      </ul>
      <p v-else class="mt-4 rounded-xl border border-dashed border-default p-5 text-muted">No upcoming stays to show yet.</p>
    </section>
  </div>
</template>
