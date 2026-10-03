<script setup lang="ts">
const profile = defineModel<BookerProfileInput>({ required: true })
defineProps<{ submitLabel: string, loading?: boolean, error?: string }>()
defineEmits<{ submit: [] }>()

function addPet() {
  profile.value.pets.push({ name: '', species: '', notes: '' })
}
</script>

<template>
  <form class="space-y-6" @submit.prevent="$emit('submit')">
    <UCard>
      <h2 class="text-xl font-semibold">About you</h2>
      <div class="mt-4 grid gap-4 sm:grid-cols-2">
        <UFormField label="Name" required><UInput v-model="profile.name" required autocomplete="name" size="xl" class="w-full" /></UFormField>
        <UFormField label="Phone" required><UInput v-model="profile.phone" required type="tel" autocomplete="tel" size="xl" class="w-full" /></UFormField>
        <UFormField label="Address" required class="sm:col-span-2">
          <UInput v-model="profile.addressLine" required autocomplete="street-address" size="xl" class="w-full" />
        </UFormField>
        <UFormField label="Town or city" required><UInput v-model="profile.city" required autocomplete="address-level2" size="xl" class="w-full" /></UFormField>
        <UFormField label="Postcode" required><UInput v-model="profile.postcode" required autocomplete="postal-code" size="xl" class="w-full" /></UFormField>
      </div>
      <UFormField class="mt-4" label="Home instructions" hint="Where things are, how to get in, quirks of the house.">
        <UTextarea v-model="profile.propertyInstructions" :rows="3" class="w-full" />
      </UFormField>
    </UCard>

    <UCard>
      <h2 class="text-xl font-semibold">Emergency contact and vet</h2>
      <div class="mt-4 grid gap-4 sm:grid-cols-2">
        <UFormField label="Emergency contact name" required><UInput v-model="profile.emergencyContact.name" required size="xl" class="w-full" /></UFormField>
        <UFormField label="Emergency contact phone" required><UInput v-model="profile.emergencyContact.phone" required type="tel" size="xl" class="w-full" /></UFormField>
        <UFormField label="Relationship"><UInput v-model="profile.emergencyContact.relationship" size="xl" class="w-full" /></UFormField>
        <span class="hidden sm:block" />
        <UFormField label="Vet name"><UInput v-model="profile.vet.name" size="xl" class="w-full" /></UFormField>
        <UFormField label="Vet phone"><UInput v-model="profile.vet.phone" type="tel" size="xl" class="w-full" /></UFormField>
      </div>
      <UFormField class="mt-4" label="If something goes wrong" hint="What should the sitter do in an emergency?">
        <UTextarea v-model="profile.emergencyInstructions" :rows="3" class="w-full" />
      </UFormField>
    </UCard>

    <UCard>
      <div class="flex items-center justify-between gap-3">
        <h2 class="text-xl font-semibold">Your pets</h2>
        <UButton type="button" color="neutral" variant="outline" icon="i-lucide-plus" @click="addPet">Add pet</UButton>
      </div>
      <p v-if="!profile.pets.length" class="mt-3 rounded-lg border border-dashed border-default p-3 text-sm text-muted">No pets added yet.</p>
      <div v-for="(pet, i) in profile.pets" :key="i" class="mt-4 rounded-xl border border-default p-4">
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField label="Name" required><UInput v-model="pet.name" required size="xl" class="w-full" /></UFormField>
          <UFormField label="Kind of pet" required><USelect v-model="pet.species" :items="PET_SPECIES" placeholder="Choose…" size="xl" class="w-full" /></UFormField>
          <UFormField label="Feeding, medication and habits" class="sm:col-span-2"><UTextarea v-model="pet.notes" :rows="2" class="w-full" /></UFormField>
        </div>
        <UButton type="button" color="error" variant="ghost" icon="i-lucide-trash-2" class="mt-3" @click="profile.pets.splice(i, 1)">Remove {{ pet.name || `pet ${i + 1}` }}</UButton>
      </div>
    </UCard>

    <div v-if="error" role="alert" class="rounded-lg border border-error/30 bg-error/5 p-3 font-semibold text-error">{{ error }}</div>
    <div class="flex justify-end">
      <UButton type="submit" size="xl" icon="i-lucide-check" :loading="loading" :disabled="loading">{{ submitLabel }}</UButton>
    </div>
  </form>
</template>
