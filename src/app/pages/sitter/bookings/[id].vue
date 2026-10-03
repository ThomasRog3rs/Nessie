<script setup lang="ts">
definePageMeta({ layout: 'sitter' })

const route = useRoute()
const workspace = useSitterWorkspace()
const toast = useToast()
const booking = computed(() => workspace.bookings.value.find(item => item.id === route.params.id))

useHead(() => ({ title: booking.value ? `${booking.value.bookerName} · Sitter booking · Nesse` : 'Sitter booking · Nesse' }))

const statusLabel = computed(() => {
  const labels: Record<string, string> = {
    requested: 'Awaiting your reply',
    accepted_times_pending: 'Accepted · handover times to agree',
    confirmed: 'Confirmed',
    declined: 'Declined',
    cancelled: 'Cancelled',
    completed: 'Completed',
  }
  return booking.value ? labels[booking.value.status] ?? booking.value.status : ''
})
const canAddSitUpdates = computed(() => booking.value?.status === 'confirmed')
const arrivalTime = ref('')
const departureTime = ref('')
const timeError = ref('')
const updateText = ref('')
const updateError = ref('')
const cancelOpen = ref(false)
const cancellationReason = ref('')
const cancellationError = ref('')
const expenseCategory = ref<'travel' | 'incidental'>('travel')
const expenseDescription = ref('')
const expenseAmount = ref('')
const expenseFileName = ref('')
const expenseError = ref('')
const photoError = ref('')
const photoCaption = ref('')
const photoInput = ref<HTMLInputElement>()
const documentInput = ref<HTMLInputElement>()

watch(booking, (value) => {
  arrivalTime.value = value?.arrivalTime ?? ''
  departureTime.value = value?.departureTime ?? ''
}, { immediate: true })

function acceptRequest() {
  if (!booking.value) return
  workspace.updateStatus(booking.value.id, 'accepted_times_pending')
  toast.add({ title: 'Request accepted', description: 'Agree the exact handover times to confirm this booking.', icon: 'i-lucide-circle-check', color: 'success' })
}

function confirmTimes() {
  if (!booking.value) return
  if (!arrivalTime.value || !departureTime.value) {
    timeError.value = 'Enter both handover times before confirming.'
    return
  }
  workspace.confirmHandoverTimes(booking.value.id, arrivalTime.value, departureTime.value)
  timeError.value = ''
  toast.add({ title: 'Handover times confirmed', description: 'The booking now has agreed arrival and departure times in this preview.', icon: 'i-lucide-calendar-check', color: 'success' })
}

function cancelBooking() {
  if (!booking.value) return
  if (!['accepted_times_pending', 'confirmed'].includes(booking.value.status)) {
    cancellationError.value = 'Only an accepted or confirmed booking can be cancelled here.'
    return
  }
  workspace.cancelBooking(booking.value.id, cancellationReason.value.trim())
  cancelOpen.value = false
  toast.add({ title: 'Booking cancelled', description: 'The cancellation is recorded in this preview only.', icon: 'i-lucide-ban', color: 'neutral' })
}

function postUpdate() {
  if (!booking.value) return
  const message = updateText.value.trim()
  if (!message) {
    updateError.value = 'Write a short update before posting.'
    return
  }
  workspace.addUpdate(booking.value.id, { id: `update-${Date.now()}`, message, createdAt: new Date().toISOString() })
  updateText.value = ''
  updateError.value = ''
  toast.add({ title: 'Update posted in preview', description: 'Your update is visible in this browser tab only.', icon: 'i-lucide-message-circle', color: 'success' })
}

function chooseExpenseDocument(event: Event) {
  const input = event.currentTarget as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png']
  if (!allowedTypes.includes(file.type)) {
    expenseError.value = 'Choose a PDF, JPG or PNG receipt (up to 10 MB).'
    input.value = ''
    return
  }
  if (file.size > 10 * 1024 * 1024) {
    expenseError.value = 'This file is larger than 10 MB. Choose a smaller receipt.'
    input.value = ''
    return
  }
  expenseFileName.value = file.name
  expenseError.value = ''
}

function addExpense() {
  if (!booking.value) return
  const amount = Number(expenseAmount.value)
  if (!expenseDescription.value.trim() || !Number.isFinite(amount) || amount <= 0) {
    expenseError.value = 'Add a description and an amount greater than £0.'
    return
  }
  workspace.addExpense(booking.value.id, {
    id: `expense-${Date.now()}`,
    category: expenseCategory.value,
    description: expenseDescription.value.trim(),
    amountPence: Math.round(amount * 100),
    fileName: expenseFileName.value,
    createdAt: new Date().toISOString(),
  })
  expenseDescription.value = ''
  expenseAmount.value = ''
  expenseFileName.value = ''
  expenseError.value = ''
  if (documentInput.value) documentInput.value.value = ''
  toast.add({ title: 'Expense recorded in preview', description: 'This amount is not part of an invoice or payment yet.', icon: 'i-lucide-receipt', color: 'success' })
}

function addPhotos(event: Event) {
  if (!booking.value) return
  const input = event.currentTarget as HTMLInputElement
  const files = [...(input.files ?? [])]
  if (!files.length) return
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
  const rejected = files.filter(file => !allowedTypes.includes(file.type) || file.size > 10 * 1024 * 1024)
  if (rejected.length) {
    photoError.value = 'Some photos were not added. Choose JPG, PNG or WebP images, each up to 10 MB.'
  }
  const valid = files.filter(file => allowedTypes.includes(file.type) && file.size <= 10 * 1024 * 1024)
  for (const file of valid) {
    workspace.addPhoto(booking.value.id, {
      id: `photo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      url: URL.createObjectURL(file),
      fileName: file.name,
      caption: photoCaption.value.trim() || `House-sitting photo with ${booking.value.pets.map(pet => pet.name).join(' and ')}.`,
      createdAt: new Date().toISOString(),
    })
  }
  if (valid.length) photoCaption.value = ''
  if (valid.length && !rejected.length) photoError.value = ''
  input.value = ''
}

function removePhoto(photoId: string) {
  if (!booking.value) return
  workspace.removePhoto(booking.value.id, photoId)
}

function formatTimestamp(instant: string) {
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(instant))
}
</script>

<template>
  <div class="mx-auto max-w-5xl">
    <NuxtLink to="/sitter/bookings" class="mb-5 inline-flex min-h-11 items-center gap-2 font-semibold text-primary hover:underline">
      <UIcon name="i-lucide-arrow-left" class="size-4" aria-hidden="true" />
      All bookings
    </NuxtLink>

    <UAlert
      v-if="!booking"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      title="We couldn't find this booking"
      description="Return to your bookings to choose an available booking."
    />

    <template v-else>
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="min-w-0">
          <p class="text-sm font-semibold text-primary">{{ booking.bookerName }}</p>
          <h1 class="mt-1 text-3xl font-semibold sm:text-4xl">{{ formatDate(booking.startDate) }} – {{ formatDate(booking.endDate) }}</h1>
          <p class="mt-2 text-toned">{{ booking.pets.map(pet => pet.name).join(' and ') }} · {{ booking.pets.map(pet => pet.species).join(', ') }}</p>
        </div>
        <UBadge
          :color="booking.status === 'confirmed' || booking.status === 'completed' ? 'success' : booking.status === 'requested' || booking.status === 'accepted_times_pending' ? 'warning' : 'neutral'"
          variant="subtle"
          :label="statusLabel"
        />
      </div>

      <UAlert
        class="mt-6"
        color="info"
        variant="subtle"
        icon="i-lucide-flask-conical"
        title="Preview only — no backend is connected"
        description="Decisions, notes and selected files stay in this browser tab. Nothing is uploaded or saved after reloading."
      />

      <div v-if="booking.status === 'requested'" class="mt-5 rounded-xl border border-warning/30 bg-warning/5 p-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
        <div>
          <h2 class="font-semibold">This request needs your decision</h2>
          <p class="mt-1 text-sm text-toned">Accepting starts the handover time agreement; it does not confirm the booking yet.</p>
        </div>
        <UButton class="mt-3 sm:mt-0" size="lg" icon="i-lucide-circle-check" @click="acceptRequest">Accept request</UButton>
      </div>

      <div v-if="booking.status === 'accepted_times_pending'" class="mt-5 rounded-xl border border-warning/30 bg-warning/5 p-4 sm:p-5">
        <h2 class="text-lg font-semibold">Agree exact handover times</h2>
        <p class="mt-1 text-sm text-toned">These were the requested times. Confirm the agreed local times to make this a confirmed booking.</p>
        <div class="mt-4 grid gap-4 sm:grid-cols-2">
          <UFormField label="Arrival time" name="arrival-time" required>
            <UInput v-model="arrivalTime" type="time" size="xl" class="w-full" />
          </UFormField>
          <UFormField label="Departure time" name="departure-time" required>
            <UInput v-model="departureTime" type="time" size="xl" class="w-full" />
          </UFormField>
        </div>
        <p v-if="timeError" class="mt-3 text-sm font-semibold text-error" role="alert">{{ timeError }}</p>
        <UButton class="mt-4" size="lg" icon="i-lucide-calendar-check" @click="confirmTimes">Confirm handover times</UButton>
      </div>

      <div class="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(17rem,0.8fr)]">
        <div class="space-y-6">
          <UCard>
            <h2 class="text-xl font-semibold">Handover</h2>
            <dl class="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <dt class="text-sm text-muted">Arrival · {{ formatDate(booking.startDate) }}</dt>
                <dd class="mt-1 font-semibold">{{ booking.arrivalTime }} <span v-if="booking.status === 'requested' || booking.status === 'accepted_times_pending'" class="font-normal text-muted">(requested)</span></dd>
              </div>
              <div>
                <dt class="text-sm text-muted">Departure · {{ formatDate(booking.endDate) }}</dt>
                <dd class="mt-1 font-semibold">{{ booking.departureTime }} <span v-if="booking.status === 'requested' || booking.status === 'accepted_times_pending'" class="font-normal text-muted">(requested)</span></dd>
              </div>
            </dl>
            <p class="mt-4 flex items-center gap-2 text-sm" :class="booking.status === 'confirmed' || booking.status === 'completed' ? 'text-success' : 'text-warning'">
              <UIcon :name="booking.status === 'confirmed' || booking.status === 'completed' ? 'i-lucide-circle-check' : 'i-lucide-clock'" class="size-4 shrink-0" aria-hidden="true" />
              {{ booking.status === 'confirmed' || booking.status === 'completed' ? 'Times agreed' : 'Requested times · not yet agreed' }} · local time at the property
            </p>
          </UCard>

          <UCard>
            <h2 class="text-xl font-semibold">Pets and care</h2>
            <ul class="mt-4 space-y-4">
              <li v-for="pet in booking.pets" :key="pet.name" class="rounded-lg bg-elevated p-3">
                <p class="font-semibold">{{ pet.name }} <span class="font-normal text-muted">· {{ pet.species }}</span></p>
                <p v-if="pet.notes" class="mt-1 text-toned">{{ pet.notes }}</p>
              </li>
            </ul>
            <p v-if="booking.careNotes" class="mt-4 whitespace-pre-line text-toned">{{ booking.careNotes }}</p>
            <p v-if="booking.status === 'confirmed' || booking.status === 'completed'" class="mt-4 border-t border-default pt-4 text-sm text-toned">{{ booking.propertyNotes }}</p>
            <p v-else class="mt-4 border-t border-default pt-4 text-sm text-muted">Private home instructions are not included before the booking is confirmed.</p>
            <div v-if="booking.services.length" class="mt-4">
              <h3 class="font-semibold">Requested services</h3>
              <ul class="mt-2 flex flex-wrap gap-2">
                <li v-for="service in booking.services" :key="service"><UBadge color="neutral" variant="subtle" :label="service" /></li>
              </ul>
            </div>
          </UCard>

          <UCard>
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 class="text-xl font-semibold">Progress updates</h2>
                <p class="mt-1 text-sm text-muted">Optional notes to keep the booker informed during the sit.</p>
              </div>
              <UBadge color="neutral" variant="subtle" icon="i-lucide-message-circle" label="Not proof of attendance" />
            </div>
            <form v-if="canAddSitUpdates" class="mt-4" @submit.prevent="postUpdate">
              <UFormField label="Write an update" name="update" hint="Share a useful note or question.">
                <UTextarea v-model="updateText" :rows="3" maxlength="1000" placeholder="How are things going?" class="w-full" />
              </UFormField>
              <p v-if="updateError" class="mt-2 text-sm font-semibold text-error" role="alert">{{ updateError }}</p>
              <UButton type="submit" class="mt-3" icon="i-lucide-send">Post update</UButton>
            </form>
            <p v-else class="mt-4 rounded-lg bg-elevated p-3 text-sm text-muted">Updates become available after handover times are agreed and the booking is confirmed.</p>

            <ol v-if="booking.updates.length" class="mt-5 space-y-4 border-l-2 border-default pl-5">
              <li v-for="update in booking.updates" :key="update.id" class="relative">
                <span class="absolute -left-[1.6rem] top-2 size-3 rounded-full bg-primary" aria-hidden="true" />
                <p class="text-sm text-muted"><time :datetime="update.createdAt">{{ formatTimestamp(update.createdAt) }}</time> · You</p>
                <p class="mt-1 whitespace-pre-line text-toned">{{ update.message }}</p>
              </li>
            </ol>
            <p v-else class="mt-4 text-sm text-muted">No updates have been shared yet.</p>
          </UCard>
        </div>

        <div class="space-y-6">
          <UCard>
            <h2 class="text-xl font-semibold">Costs and receipts</h2>
            <p class="mt-1 text-sm text-muted">Record agreed costs separately. Receipts support an expense record; they do not prove attendance.</p>
            <dl class="mt-4 space-y-2">
              <div v-if="booking.requestedTravelPence" class="flex justify-between gap-3">
                <dt>Travel reimbursement proposed</dt>
                <dd class="shrink-0 font-semibold">{{ formatMoney(booking.requestedTravelPence) }}</dd>
              </div>
              <div v-for="item in booking.requestedIncidentals" :key="item.description" class="flex justify-between gap-3">
                <dt class="min-w-0">{{ item.description }} <span class="text-sm text-muted">(proposed)</span></dt>
                <dd class="shrink-0 font-semibold">{{ formatMoney(item.amountPence) }}</dd>
              </div>
              <div v-for="expense in booking.expenses" :key="expense.id" class="flex justify-between gap-3 border-t border-default pt-2">
                <dt class="min-w-0">
                  {{ expense.description }}
                  <span class="block text-sm text-muted">{{ expense.category === 'travel' ? 'Travel' : 'Incidental' }}<span v-if="expense.fileName"> · {{ expense.fileName }}</span></span>
                </dt>
                <dd class="shrink-0 font-semibold">{{ formatMoney(expense.amountPence) }}</dd>
              </div>
            </dl>
            <p v-if="!booking.requestedTravelPence && !booking.requestedIncidentals.length && !booking.expenses.length" class="mt-3 text-sm text-muted">No travel or incidental expenses have been recorded.</p>
            <p class="mt-3 rounded-lg bg-elevated p-3 text-sm text-toned">First-class travel is not reimbursable by default. Agree standard/economy travel and incidental costs in advance. These expense records can inform future invoice work; no total is reconciled, and no invoice or payment is created here.</p>

            <form v-if="canAddSitUpdates" class="mt-5 space-y-4 border-t border-default pt-5" @submit.prevent="addExpense">
              <h3 class="font-semibold">Add an expense</h3>
              <UFormField label="Expense type" name="expense-category" required>
                <USelect v-model="expenseCategory" :items="[{ label: 'Travel', value: 'travel' }, { label: 'Incidental', value: 'incidental' }]" size="xl" class="w-full" />
              </UFormField>
              <UFormField label="Description" name="expense-description" required>
                <UInput v-model="expenseDescription" maxlength="120" placeholder="e.g. Return train ticket" size="xl" class="w-full" />
              </UFormField>
              <UFormField label="Cost (£)" name="expense-amount" required hint="Enter the actual amount in pounds.">
                <UInput v-model="expenseAmount" type="number" min="0.01" step="0.01" inputmode="decimal" size="xl" class="w-full" />
              </UFormField>
              <div>
                <input ref="documentInput" class="hidden" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" @change="chooseExpenseDocument">
                <UButton type="button" color="neutral" variant="outline" icon="i-lucide-paperclip" @click="documentInput?.click()">
                  {{ expenseFileName || 'Attach receipt (optional)' }}
                </UButton>
                <p class="mt-2 text-xs text-muted">PDF, JPG or PNG · up to 10 MB. The selected file stays on this device; only its name is shown in the preview.</p>
              </div>
              <p v-if="expenseError" role="alert" class="text-sm font-semibold text-error">{{ expenseError }}</p>
              <UButton type="submit" icon="i-lucide-plus">Record expense</UButton>
            </form>
            <p v-else class="mt-5 border-t border-default pt-4 text-sm text-muted">New expenses can be added during a confirmed sit.</p>
          </UCard>

          <UCard>
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 class="text-xl font-semibold">House-sitting photos</h2>
                <p class="mt-1 text-sm text-muted">Share moments with the booker during a confirmed sit.</p>
              </div>
              <UBadge color="neutral" variant="subtle" icon="i-lucide-image" label="Optional" />
            </div>
            <div v-if="canAddSitUpdates" class="mt-4">
              <UFormField class="mb-3" label="Photo caption (optional)" name="photo-caption" hint="Add a short description to help the booker and anyone using a screen reader.">
                <UInput v-model="photoCaption" maxlength="160" placeholder="e.g. Milo enjoying a morning walk" size="xl" class="w-full" />
              </UFormField>
              <input ref="photoInput" class="hidden" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" multiple @change="addPhotos">
              <UButton type="button" color="neutral" variant="outline" icon="i-lucide-images" @click="photoInput?.click()">Choose photos</UButton>
              <p class="mt-2 text-xs text-muted">JPG, PNG or WebP · up to 10 MB each. Selected photos remain in this tab only and are removed when reloaded.</p>
              <p v-if="photoError" role="alert" class="mt-2 text-sm font-semibold text-error">{{ photoError }}</p>
            </div>
            <p v-else class="mt-4 rounded-lg bg-elevated p-3 text-sm text-muted">Photos become available after handover times are agreed and the booking is confirmed.</p>

            <ul v-if="booking.photos.length" class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <li v-for="photo in booking.photos" :key="photo.id" class="group relative overflow-hidden rounded-xl border border-default">
                <img :src="photo.url" :alt="photo.caption" class="aspect-square w-full object-cover" width="240" height="240" loading="lazy">
                <div class="flex items-center justify-between gap-2 p-2">
                  <span class="min-w-0 break-all text-xs text-muted">{{ photo.caption }}</span>
                  <UButton type="button" color="error" variant="ghost" icon="i-lucide-trash-2" :aria-label="`Remove ${photo.fileName}`" @click="removePhoto(photo.id)" />
                </div>
              </li>
            </ul>
            <p v-else class="mt-4 text-sm text-muted">No photos have been shared yet.</p>
          </UCard>

          <UCard v-if="booking.status === 'confirmed' || booking.status === 'completed'">
            <h2 class="text-xl font-semibold">Emergency details</h2>
            <div class="mt-4">
              <h3 class="font-semibold">Booker’s emergency contact</h3>
              <p class="mt-1 text-toned">{{ booking.emergencyContact.name }} <span v-if="booking.emergencyContact.relationship" class="text-muted">· {{ booking.emergencyContact.relationship }}</span></p>
              <a :href="`tel:${booking.emergencyContact.phone}`" class="inline-flex min-h-11 items-center gap-2 font-semibold text-primary hover:underline">
                <UIcon name="i-lucide-phone" class="size-4" aria-hidden="true" />
                {{ booking.emergencyContact.phone }}
              </a>
            </div>
            <div v-if="booking.vet.name" class="mt-4 border-t border-default pt-4">
              <h3 class="font-semibold">Veterinary contact</h3>
              <p class="mt-1 text-toned">{{ booking.vet.name }}</p>
              <a :href="`tel:${booking.vet.phone}`" class="inline-flex min-h-11 items-center gap-2 font-semibold text-primary hover:underline">
                <UIcon name="i-lucide-phone" class="size-4" aria-hidden="true" />
                {{ booking.vet.phone }}
              </a>
            </div>
            <p v-if="booking.emergencyInstructions" class="mt-3 rounded-lg bg-elevated p-3 text-sm text-toned">{{ booking.emergencyInstructions }}</p>
          </UCard>
        </div>
      </div>

      <UAlert
        v-if="booking.alternativeCareTermAcknowledged && ['confirmed', 'completed', 'cancelled'].includes(booking.status)"
        class="mt-6"
        color="warning"
        variant="subtle"
        icon="i-lucide-clock-3"
        title="72-hour cancellation term acknowledged"
        :description="`The recorded term applies to cancellation within 72 hours of the agreed start (${formatDate(booking.startDate)} at ${booking.arrivalTime}). Nesse records the parties’ stated term only and does not decide liability or collect costs.`"
      />

      <div v-if="booking.status === 'confirmed' || booking.status === 'accepted_times_pending'" class="mt-6 border-t border-default pt-6">
        <UModal v-model:open="cancelOpen" title="Cancel this booking?" description="The booker will be notified and the cancellation recorded. This preview does not send notifications.">
          <UButton color="error" variant="outline" size="lg" icon="i-lucide-ban">Cancel booking</UButton>
          <template #body>
            <p v-if="booking.alternativeCareTermAcknowledged" class="text-sm text-toned">
              The 72-hour cancellation term was acknowledged for {{ formatDate(booking.startDate) }} at {{ booking.arrivalTime }}. Nesse records the stated term only and does not decide liability.
            </p>
            <UFormField class="mt-4" label="Reason (optional)" name="cancellation-reason">
              <UTextarea v-model="cancellationReason" :rows="3" class="w-full" />
            </UFormField>
            <p v-if="cancellationError" class="mt-3 text-sm font-semibold text-error" role="alert">{{ cancellationError }}</p>
          </template>
          <template #footer>
            <div class="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <UButton color="neutral" variant="outline" size="lg" @click="cancelOpen = false">Keep booking</UButton>
              <UButton color="error" size="lg" icon="i-lucide-ban" @click="cancelBooking">Confirm cancellation</UButton>
            </div>
          </template>
        </UModal>
      </div>

      <section aria-labelledby="history-heading" class="mt-10 border-t border-default pt-6">
        <h2 id="history-heading" class="text-xl font-semibold">Booking history</h2>
        <ol class="mt-4 space-y-4 border-l-2 border-default pl-5">
          <li v-for="event in [...booking.events].sort((a, b) => b.createdAt.localeCompare(a.createdAt))" :key="event.id" class="relative">
            <span class="absolute -left-[1.6rem] top-2 size-3 rounded-full bg-primary" aria-hidden="true" />
            <p class="text-sm text-muted"><time :datetime="event.createdAt">{{ formatTimestamp(event.createdAt) }}</time> · {{ event.actor === 'booker' ? booking.bookerName : 'You' }}</p>
            <p class="font-semibold">{{ event.label }}</p>
            <p class="whitespace-pre-line text-toned">{{ event.detail }}</p>
          </li>
        </ol>
      </section>
    </template>
  </div>
</template>
