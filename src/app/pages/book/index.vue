<script setup lang="ts">
import { CalendarDate, parseDate, today } from '@internationalized/date'
import type { DateValue } from '@internationalized/date'

useHead({ title: 'Choose dates · Nesse' })

const api = useBookingApi()
const draft = useBookingDraftStore()

const { data: sitter, error: sitterError, refresh: refreshSitter } = await useAsyncData('sitter', () => api.getSitter())

const todayDate = today(sitter.value?.timezone ?? 'Europe/London')
const windowEnd = todayDate.add({ months: 18 })

const { data: availability, status: availabilityStatus, error: availabilityError, refresh: refreshAvailability } = await useAsyncData(
  'availability',
  () => api.getAvailability(todayDate.toString(), windowEnd.toString()),
  { lazy: true, default: () => [] },
)

const blocked = computed(() => new Set(availability.value.filter(d => d.status !== 'available').map(d => d.date)))
const isDateUnavailable = (d: DateValue) => blocked.value.has(d.toString())

const range = shallowRef<{ start: DateValue | undefined, end: DateValue | undefined }>({
  start: draft.startDate ? parseDate(draft.startDate) : undefined,
  end: draft.endDate ? parseDate(draft.endDate) : undefined,
})

const wide = useMediaQuery('(min-width: 1024px)')

const nights = computed(() =>
  range.value.start && range.value.end ? nightsBetween(range.value.start.toString(), range.value.end.toString()) : 0)

// A range must not span a night that is already held.
const rangeConflict = computed(() => {
  const { start, end } = range.value
  if (!start || !end) return false
  for (let d = start as CalendarDate; d.compare(end) < 0; d = d.add({ days: 1 })) {
    if (blocked.value.has(d.toString())) return true
  }
  return false
})

const submitted = ref(false)
const errors = computed(() => {
  const e: Record<string, string> = {}
  if (!range.value.start || !range.value.end) e.dates = 'Select an arrival date and a departure date.'
  else if (nights.value < 1) e.dates = 'The departure date must be after the arrival date.'
  else if (rangeConflict.value) e.dates = 'Some of these nights are already booked. Choose different dates.'
  if (!draft.arrivalTime) e.arrival = 'Enter a preferred arrival time.'
  if (!draft.departureTime) e.departure = 'Enter a preferred departure time.'
  return e
})

function next() {
  submitted.value = true
  if (Object.keys(errors.value).length) {
    document.getElementById(errors.value.dates ? 'dates-heading' : errors.value.arrival ? 'arrival-time' : 'departure-time')?.focus()
    return
  }
  draft.startDate = range.value.start!.toString()
  draft.endDate = range.value.end!.toString()
  navigateTo('/book/details')
}

function clear() {
  range.value = { start: undefined, end: undefined }
  submitted.value = false
}
</script>

<template>
  <div>
    <BookingSteps :current="1" />
    <h1 class="mb-6 text-3xl font-semibold">Choose your dates</h1>

    <UAlert
      v-if="sitterError"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      title="We couldn't load your sitter"
      description="Check your connection and try again."
      :actions="[{ label: 'Try again', color: 'error', variant: 'outline', onClick: () => refreshSitter() }]"
    />

    <div v-else-if="sitter" class="grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
      <div class="space-y-6">
        <SitterCard :sitter="sitter" />

        <section aria-labelledby="dates-heading" class="space-y-3">
          <h2 id="dates-heading" tabindex="-1" class="text-xl font-semibold outline-none">Arrival and departure</h2>
          <p class="text-muted">Tap your arrival date, then your departure date. You are charged per night.</p>

          <UAlert
            v-if="availabilityError"
            color="warning"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            title="Availability couldn't be loaded"
            :actions="[{ label: 'Try again', color: 'warning', variant: 'outline', onClick: () => refreshAvailability() }]"
          />

          <div class="rounded-xl border border-default bg-default p-3 sm:p-4" :aria-busy="availabilityStatus === 'pending'">
            <USkeleton v-if="availabilityStatus === 'pending'" class="h-72 w-full" />
            <UCalendar
              v-else
              v-model="range"
              range
              :number-of-months="wide ? 2 : 1"
              :min-value="todayDate"
              :max-value="windowEnd"
              :is-date-unavailable="isDateUnavailable"
              :week-starts-on="1"
              fixed-weeks
              size="lg"
              class="w-full"
              aria-label="Select arrival and departure dates"
            />
          </div>

          <ul class="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
            <li class="flex items-center gap-2"><span class="size-3 rounded-full bg-primary" aria-hidden="true" /> Selected</li>
            <li class="flex items-center gap-2"><span class="line-through">12</span> Not available (already booked)</li>
          </ul>

          <p v-if="submitted && errors.dates" role="alert" class="flex items-center gap-2 font-semibold text-error">
            <UIcon name="i-lucide-circle-alert" class="size-5 shrink-0" aria-hidden="true" />
            {{ errors.dates }}
          </p>
        </section>

        <fieldset class="space-y-3">
          <legend class="text-xl font-semibold font-display text-primary">Preferred handover times</legend>
          <p class="text-muted">
            These are <strong>requested</strong> times. The sitter will confirm or propose exact times after accepting.
            Times are local to the property ({{ sitter.timezone.replace('_', ' ') }}).
          </p>
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField label="Arrival time" name="arrival" required :error="submitted ? errors.arrival : undefined" :ui="{ label: 'font-semibold' }">
              <UInput id="arrival-time" v-model="draft.arrivalTime" type="time" size="xl" class="w-full" />
            </UFormField>
            <UFormField label="Departure time" name="departure" required :error="submitted ? errors.departure : undefined" :ui="{ label: 'font-semibold' }">
              <UInput id="departure-time" v-model="draft.departureTime" type="time" size="xl" class="w-full" />
            </UFormField>
          </div>
        </fieldset>
      </div>

      <aside aria-label="Booking summary" class="lg:sticky lg:top-24">
        <UCard>
          <h2 class="text-lg font-semibold">Your stay</h2>
          <dl v-if="range.start && range.end && nights >= 1" class="mt-3 space-y-2">
            <div>
              <dt class="text-sm text-muted">Arrive</dt>
              <dd class="font-semibold">{{ formatDate(range.start.toString()) }} · {{ draft.arrivalTime }}</dd>
            </div>
            <div>
              <dt class="text-sm text-muted">Depart</dt>
              <dd class="font-semibold">{{ formatDate(range.end.toString()) }} · {{ draft.departureTime }}</dd>
            </div>
            <div>
              <dt class="text-sm text-muted">Sitting fee</dt>
              <dd class="font-semibold">
                {{ nights }} {{ nights === 1 ? 'night' : 'nights' }} × {{ formatMoney(sitter.rate) }} = {{ formatMoney(nights * sitter.rate) }}
              </dd>
            </div>
          </dl>
          <p v-else class="mt-3 text-muted">No dates selected yet.</p>

          <div class="mt-5 flex flex-col gap-2">
            <UButton size="xl" block trailing-icon="i-lucide-arrow-right" @click="next">Continue to details</UButton>
            <UButton v-if="range.start" size="lg" block color="neutral" variant="ghost" @click="clear">Clear dates</UButton>
          </div>
        </UCard>
      </aside>
    </div>

    <USkeleton v-else class="h-40 w-full" />
  </div>
</template>
