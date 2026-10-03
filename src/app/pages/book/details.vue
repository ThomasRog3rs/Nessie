<script setup lang="ts">
import type { FormError } from '@nuxt/ui'

useHead({ title: 'Booking details · Nesse' })

const api = useBookingApi()
const draft = useBookingDraftStore()

if (!draft.hasDates) await navigateTo('/book')

const { data: sitter } = await useAsyncData('sitter', () => api.getSitter())

const speciesItems = computed(() => sitter.value?.acceptedPets ?? [])
const serviceItems = computed(() =>
  (sitter.value?.optionalServices ?? []).map(s => ({
    value: s.id,
    label: `${s.name} – ${formatMoney(s.price)} per night`,
    description: s.description,
  })))

const money = { style: 'currency', currency: 'GBP' } as const

function validate(): FormError[] {
  const errors: FormError[] = []
  draft.pets.forEach((p, i) => {
    if (!p.name.trim()) errors.push({ name: `pets.${i}.name`, message: 'Enter the pet\'s name.' })
    if (!p.species) errors.push({ name: `pets.${i}.species`, message: 'Choose what kind of pet this is.' })
  })
  draft.incidentalExpenses.forEach((e, i) => {
    if (!e.description.trim()) errors.push({ name: `incidentals.${i}.description`, message: 'Describe this expense, or remove it.' })
    if (e.amount === undefined || e.amount < 0) errors.push({ name: `incidentals.${i}.amount`, message: 'Enter the agreed amount.' })
  })
  if (!draft.emergencyContact.name.trim()) errors.push({ name: 'emergencyName', message: 'Enter an emergency contact name.' })
  if (!draft.emergencyContact.phone.trim()) errors.push({ name: 'emergencyPhone', message: 'Enter a phone number we can reach them on.' })
  return errors
}
</script>

<template>
  <div>
    <BookingSteps :current="2" />
    <h1 class="text-3xl font-semibold">Care details</h1>
    <p class="mt-2 max-w-prose text-muted">
      Tell your sitter what they need to know. Please don't include your home address or door codes yet – those are shared once the booking is confirmed.
    </p>

    <UForm :state="draft" :validate="validate" :validate-on="['blur']" class="mt-8 space-y-10" @submit="navigateTo('/book/review')">
      <section aria-labelledby="pets-h" class="space-y-4">
        <h2 id="pets-h" class="text-xl font-semibold">Pets</h2>
        <UCard v-for="(pet, i) in draft.pets" :key="i">
          <div class="mb-3 flex items-center justify-between gap-2">
            <h3 class="text-base font-semibold">Pet {{ i + 1 }}</h3>
            <UButton
              v-if="draft.pets.length > 1"
              color="error"
              variant="ghost"
              icon="i-lucide-trash-2"
              :aria-label="`Remove pet ${i + 1}`"
              size="lg"
              @click="draft.removePet(i)"
            />
          </div>
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField :name="`pets.${i}.name`" label="Name" required>
              <UInput v-model="pet.name" size="xl" class="w-full" autocomplete="off" />
            </UFormField>
            <UFormField :name="`pets.${i}.species`" label="Kind of pet" required>
              <USelect v-model="pet.species" :items="speciesItems" placeholder="Choose…" size="xl" class="w-full" />
            </UFormField>
            <UFormField :name="`pets.${i}.notes`" label="Feeding, medication and habits" class="sm:col-span-2">
              <UTextarea v-model="pet.notes" :rows="3" class="w-full" />
            </UFormField>
          </div>
        </UCard>
        <UButton color="neutral" variant="outline" size="lg" icon="i-lucide-plus" @click="draft.addPet()">Add another pet</UButton>
      </section>

      <section aria-labelledby="care-h" class="space-y-4">
        <h2 id="care-h" class="text-xl font-semibold">Care and property notes</h2>
        <UFormField name="careNotes" label="Care needs" help="Routines, walks, plants, post, anything the sitter should do.">
          <UTextarea v-model="draft.careNotes" :rows="4" class="w-full" />
        </UFormField>
        <UFormField name="propertyInstructions" label="Property instructions" help="General guidance only. Don't include your address or access codes at this stage.">
          <UTextarea v-model="draft.propertyInstructions" :rows="3" class="w-full" />
        </UFormField>
      </section>

      <section v-if="serviceItems.length" aria-labelledby="svc-h" class="space-y-4">
        <h2 id="svc-h" class="text-xl font-semibold">Optional services</h2>
        <UCheckboxGroup v-model="draft.optionalServiceIds" :items="serviceItems" legend="Optional services (charged per night, in addition to the nightly rate)" variant="card" />
      </section>

      <section aria-labelledby="cost-h" class="space-y-4">
        <h2 id="cost-h" class="text-xl font-semibold">Travel and other expenses</h2>
        <p class="max-w-prose text-muted">
          Nesse only records what you agree – payment happens outside the app. First-class travel is not reimbursable; standard or economy class is expected.
        </p>
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField name="travelAmount" label="Proposed travel reimbursement" help="Leave blank if none.">
            <UInputNumber v-model="draft.travelAmount" :min="0" :format-options="money" :increment="false" :decrement="false" size="xl" class="w-full" />
          </UFormField>
          <UFormField name="travelNotes" label="Travel notes">
            <UInput v-model="draft.travelNotes" size="xl" class="w-full" placeholder="e.g. Standard class train from Leeds" />
          </UFormField>
        </div>

        <fieldset class="space-y-3">
          <legend class="font-semibold">Incidental expenses agreed in advance</legend>
          <p class="text-sm text-muted">Snacks, drinks and similar costs are itemised separately – they are never added to the rate or travel.</p>
          <div v-for="(exp, i) in draft.incidentalExpenses" :key="i" class="grid gap-3 sm:grid-cols-[1fr_10rem_auto] sm:items-start">
            <UFormField :name="`incidentals.${i}.description`" label="Item">
              <UInput v-model="exp.description" size="xl" class="w-full" />
            </UFormField>
            <UFormField :name="`incidentals.${i}.amount`" label="Amount">
              <UInputNumber v-model="exp.amount" :min="0" :format-options="money" :increment="false" :decrement="false" size="xl" class="w-full" />
            </UFormField>
            <UButton class="sm:mt-6" color="error" variant="ghost" icon="i-lucide-trash-2" size="xl" :aria-label="`Remove expense ${i + 1}`" @click="draft.removeExpense(i)" />
          </div>
          <UButton color="neutral" variant="outline" size="lg" icon="i-lucide-plus" @click="draft.addExpense()">Add an expense</UButton>
        </fieldset>
      </section>

      <section aria-labelledby="em-h" class="space-y-4">
        <h2 id="em-h" class="text-xl font-semibold">Emergency details</h2>
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField name="emergencyName" label="Emergency contact name" required>
            <UInput v-model="draft.emergencyContact.name" size="xl" class="w-full" autocomplete="off" />
          </UFormField>
          <UFormField name="emergencyPhone" label="Emergency contact phone" required>
            <UInput v-model="draft.emergencyContact.phone" type="tel" inputmode="tel" size="xl" class="w-full" autocomplete="off" />
          </UFormField>
          <UFormField name="emergencyRelationship" label="Relationship to you">
            <UInput v-model="draft.emergencyContact.relationship" size="xl" class="w-full" />
          </UFormField>
          <span class="hidden sm:block" />
          <UFormField name="vetName" label="Vet name">
            <UInput v-model="draft.vet.name" size="xl" class="w-full" />
          </UFormField>
          <UFormField name="vetPhone" label="Vet phone">
            <UInput v-model="draft.vet.phone" type="tel" inputmode="tel" size="xl" class="w-full" />
          </UFormField>
        </div>
        <UFormField name="emergencyInstructions" label="Property-specific emergency instructions" help="For example where the stopcock or fuse box is.">
          <UTextarea v-model="draft.emergencyInstructions" :rows="3" class="w-full" />
        </UFormField>
      </section>

      <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <UButton to="/book" size="xl" color="neutral" variant="outline" icon="i-lucide-arrow-left">Back to dates</UButton>
        <UButton type="submit" size="xl" trailing-icon="i-lucide-arrow-right">Review request</UButton>
      </div>
    </UForm>
  </div>
</template>
