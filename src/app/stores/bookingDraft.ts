import { defineStore } from 'pinia'

export interface DraftPet { name: string, species: string, notes: string }
export interface DraftExpense { description: string, amount: number | undefined }

// Money in the draft is in pounds (what people type); it is converted to pence on submit.
const emptyPet = (): DraftPet => ({ name: '', species: '', notes: '' })

export const useBookingDraftStore = defineStore('bookingDraft', () => {
  const startDate = ref<string>()
  const endDate = ref<string>()
  const arrivalTime = ref('10:00')
  const departureTime = ref('17:00')

  const pets = ref<DraftPet[]>([emptyPet()])
  const careNotes = ref('')
  const propertyInstructions = ref('')
  const optionalServiceIds = ref<string[]>([])
  const travelAmount = ref<number>()
  const travelNotes = ref('')
  const incidentalExpenses = ref<DraftExpense[]>([])
  const emergencyContact = ref({ name: '', phone: '', relationship: '' })
  const vet = ref({ name: '', phone: '' })
  const emergencyInstructions = ref('')
  const cancellationTermAcknowledged = ref(false)

  const nights = computed(() =>
    startDate.value && endDate.value ? nightsBetween(startDate.value, endDate.value) : 0)
  const hasDates = computed(() => nights.value >= 1)

  function addPet() { pets.value.push(emptyPet()) }
  function removePet(i: number) { if (pets.value.length > 1) pets.value.splice(i, 1) }
  function addExpense() { incidentalExpenses.value.push({ description: '', amount: undefined }) }
  function removeExpense(i: number) { incidentalExpenses.value.splice(i, 1) }

  function toRequest(sitterId: string): BookingRequest {
    const pence = (n: number | undefined) => Math.round((n ?? 0) * 100)
    return {
      sitterId,
      startDate: startDate.value!,
      endDate: endDate.value!,
      arrivalTime: arrivalTime.value,
      departureTime: departureTime.value,
      pets: pets.value.map(p => ({ ...p })),
      careNotes: careNotes.value,
      propertyInstructions: propertyInstructions.value,
      optionalServiceIds: [...optionalServiceIds.value],
      travelReimbursement: { amount: pence(travelAmount.value), notes: travelNotes.value },
      incidentalExpenses: incidentalExpenses.value
        .filter(e => e.description.trim())
        .map(e => ({ description: e.description.trim(), amount: pence(e.amount) })),
      emergencyContact: { ...emergencyContact.value },
      vet: { ...vet.value },
      emergencyInstructions: emergencyInstructions.value,
      cancellationTermAcknowledged: cancellationTermAcknowledged.value,
    }
  }

  /** Fills only blank fields, so anything the booker already typed in this draft is kept. */
  function prefillFromProfile(profile: BookerProfile) {
    if (pets.value.every(p => !p.name.trim() && !p.species && !p.notes.trim()) && profile.pets.length > 0) {
      pets.value = profile.pets.map(p => ({ ...p }))
    }
    if (!propertyInstructions.value.trim()) propertyInstructions.value = profile.propertyInstructions
    if (!emergencyContact.value.name && !emergencyContact.value.phone && !emergencyContact.value.relationship) {
      emergencyContact.value = { ...profile.emergencyContact }
    }
    if (!vet.value.name && !vet.value.phone) vet.value = { ...profile.vet }
    if (!emergencyInstructions.value.trim()) emergencyInstructions.value = profile.emergencyInstructions
  }

  function $reset() {
    startDate.value = endDate.value = undefined
    arrivalTime.value = '10:00'
    departureTime.value = '17:00'
    pets.value = [emptyPet()]
    careNotes.value = propertyInstructions.value = travelNotes.value = emergencyInstructions.value = ''
    optionalServiceIds.value = []
    travelAmount.value = undefined
    incidentalExpenses.value = []
    emergencyContact.value = { name: '', phone: '', relationship: '' }
    vet.value = { name: '', phone: '' }
    cancellationTermAcknowledged.value = false
  }

  return {
    startDate, endDate, arrivalTime, departureTime, pets, careNotes, propertyInstructions,
    optionalServiceIds, travelAmount, travelNotes, incidentalExpenses, emergencyContact, vet,
    emergencyInstructions, cancellationTermAcknowledged, nights, hasDates,
    addPet, removePet, addExpense, removeExpense, prefillFromProfile, toRequest, $reset,
  }
})
