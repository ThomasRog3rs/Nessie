export type SitterWorkspaceStatus = 'requested' | 'declined' | 'accepted_times_pending' | 'confirmed' | 'completed' | 'cancelled'
export type SitterExpenseCategory = 'travel' | 'incidental'

export interface SitterProfileDraft {
  name: string
  location: string
  bio: string
  ratePence: number
  rateBasis: 'per_night' | 'per_day'
  acceptedPets: string[]
  phone: string
  services: { id: string, name: string, pricePence: number }[]
}

export interface SitterWorkspacePet {
  name: string
  species: string
  notes: string
}

export interface SitterWorkspaceExpense {
  id: string
  category: SitterExpenseCategory
  description: string
  amountPence: number
  fileName: string
  createdAt: string
}

export interface SitterWorkspacePhoto {
  id: string
  url: string
  fileName: string
  caption: string
  createdAt: string
}

export interface SitterWorkspaceUpdate {
  id: string
  message: string
  createdAt: string
}

export interface SitterWorkspaceEvent {
  id: string
  actor: 'booker' | 'sitter'
  label: string
  detail: string
  createdAt: string
}

export interface SitterWorkspaceBooking {
  id: string
  bookerName: string
  bookerInitials: string
  requestedAt: string
  startDate: string
  endDate: string
  arrivalTime: string
  departureTime: string
  status: SitterWorkspaceStatus
  pets: SitterWorkspacePet[]
  careNotes: string
  propertyNotes: string
  services: string[]
  requestedTravelPence: number
  requestedIncidentals: { description: string, amountPence: number }[]
  emergencyContact: { name: string, relationship: string, phone: string }
  vet: { name: string, phone: string }
  emergencyInstructions: string
  alternativeCareTermAcknowledged: boolean
  declineReason: string
  cancellationReason: string
  expenses: SitterWorkspaceExpense[]
  photos: SitterWorkspacePhoto[]
  updates: SitterWorkspaceUpdate[]
  events: SitterWorkspaceEvent[]
}

export interface SitterUnavailableBlock {
  id: string
  startDate: string
  endDate: string
  reason: string
}

function dateOffset(days: number): string {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function demoBookings(): SitterWorkspaceBooking[] {
  const now = new Date().toISOString()
  const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString()
  return [
    {
      id: 'request-olivia',
      bookerName: 'Olivia Parker',
      bookerInitials: 'OP',
      requestedAt: now,
      startDate: dateOffset(12),
      endDate: dateOffset(16),
      arrivalTime: '16:00',
      departureTime: '10:00',
      status: 'requested',
      pets: [{ name: 'Milo', species: 'Golden retriever', notes: 'Two walks a day; he loves the river path.' }],
      careNotes: 'Please water the herbs in the kitchen and bring in any parcels.',
      propertyNotes: 'Entry instructions are available in the confirmed booking.',
      services: ['Dog walking'],
      requestedTravelPence: 1800,
      requestedIncidentals: [],
      emergencyContact: { name: 'Ruth Parker', relationship: 'Neighbour', phone: '07700 900 818' },
      vet: { name: 'Clifton Veterinary Centre', phone: '0117 555 0182' },
      emergencyInstructions: 'Call Ruth first if you cannot reach Olivia.',
      alternativeCareTermAcknowledged: false,
      declineReason: '',
      cancellationReason: '',
      expenses: [],
      photos: [],
      updates: [],
      events: [{ id: 'event-request-olivia', actor: 'booker', label: 'Request received', detail: 'Olivia sent a booking request.', createdAt: now }],
    },
    {
      id: 'request-james',
      bookerName: 'James Holloway',
      bookerInitials: 'JH',
      requestedAt: minutesAgo(10),
      startDate: dateOffset(22),
      endDate: dateOffset(25),
      arrivalTime: '17:30',
      departureTime: '09:30',
      status: 'accepted_times_pending',
      pets: [{ name: 'Pip', species: 'Tabby cat', notes: 'Medication with breakfast.' }],
      careNotes: 'Pip is shy at first. His carrier and vet details are in the care pack.',
      propertyNotes: 'Full house instructions are shared after confirming handover times.',
      services: [],
      requestedTravelPence: 0,
      requestedIncidentals: [],
      emergencyContact: { name: 'Sam Holloway', relationship: 'Partner', phone: '07700 900 237' },
      vet: { name: 'Redland Pet Clinic', phone: '0117 555 0166' },
      emergencyInstructions: 'Call James or Sam for any urgent care decisions.',
      alternativeCareTermAcknowledged: true,
      declineReason: '',
      cancellationReason: '',
      expenses: [],
      photos: [],
      updates: [],
      events: [
        { id: 'event-accept-james', actor: 'sitter', label: 'Request accepted', detail: 'Exact handover times still need agreement.', createdAt: minutesAgo(5) },
        { id: 'event-request-james', actor: 'booker', label: 'Request received', detail: 'James sent a booking request.', createdAt: minutesAgo(10) },
      ],
    },
    {
      id: 'stay-amina',
      bookerName: 'Amina Shah',
      bookerInitials: 'AS',
      requestedAt: minutesAgo(4 * 24 * 60),
      startDate: dateOffset(4),
      endDate: dateOffset(8),
      arrivalTime: '15:00',
      departureTime: '11:00',
      status: 'confirmed',
      pets: [
        { name: 'Fern', species: 'Whippet', notes: 'One long walk and one short walk each day.' },
        { name: 'Olive', species: 'House cat', notes: 'Fresh water each morning.' },
      ],
      careNotes: 'The neighbours know you are staying. Please bring the bins out on Thursday evening.',
      propertyNotes: 'Entry and emergency instructions have been shared in the booking.',
      services: ['Dog walking'],
      requestedTravelPence: 2400,
      requestedIncidentals: [{ description: 'Pet food top-up', amountPence: 950 }],
      emergencyContact: { name: 'Maya Shah', relationship: 'Sister', phone: '07700 900 412' },
      vet: { name: 'Harbourside Veterinary Surgery', phone: '0117 555 0144' },
      emergencyInstructions: 'Call Amina first. Maya can help if Amina is travelling.',
      alternativeCareTermAcknowledged: true,
      declineReason: '',
      cancellationReason: '',
      expenses: [],
      photos: [],
      updates: [
        { id: 'update-amina-1', message: 'Everything is ready for Fern and Olive. I’ll message if anything comes up.', createdAt: minutesAgo(60) },
      ],
      events: [
        { id: 'event-update-amina', actor: 'sitter', label: 'Progress update posted', detail: 'Everything is ready for Fern and Olive. I’ll message if anything comes up.', createdAt: minutesAgo(60) },
        { id: 'event-times-amina', actor: 'sitter', label: 'Handover times agreed', detail: 'Arrival and departure times were confirmed.', createdAt: minutesAgo(2 * 24 * 60) },
        { id: 'event-accept-amina', actor: 'sitter', label: 'Request accepted', detail: 'The request was accepted.', createdAt: minutesAgo(3 * 24 * 60) },
        { id: 'event-request-amina', actor: 'booker', label: 'Request received', detail: 'Amina sent a booking request.', createdAt: minutesAgo(4 * 24 * 60) },
      ],
    },
    {
      id: 'stay-george',
      bookerName: 'George Reed',
      bookerInitials: 'GR',
      requestedAt: minutesAgo(22 * 24 * 60),
      startDate: dateOffset(-21),
      endDate: dateOffset(-18),
      arrivalTime: '14:00',
      departureTime: '10:00',
      status: 'completed',
      pets: [{ name: 'Bean', species: 'Rescue cat', notes: 'A quiet spot to nap is all she needs.' }],
      careNotes: 'Please keep the back door locked after the evening feed.',
      propertyNotes: 'Booking instructions were shared with the sitter.',
      services: [],
      requestedTravelPence: 0,
      requestedIncidentals: [],
      emergencyContact: { name: 'Leo Reed', relationship: 'Brother', phone: '07700 900 512' },
      vet: { name: 'Westside Vets', phone: '0117 555 0110' },
      emergencyInstructions: 'Call Leo if George is unavailable.',
      alternativeCareTermAcknowledged: false,
      declineReason: '',
      cancellationReason: '',
      expenses: [],
      photos: [],
      updates: [],
      events: [
        { id: 'event-complete-george', actor: 'sitter', label: 'Sit completed', detail: 'The booking was marked complete.', createdAt: minutesAgo(18 * 24 * 60) },
        { id: 'event-times-george', actor: 'sitter', label: 'Handover times agreed', detail: 'Arrival and departure times were confirmed.', createdAt: minutesAgo(20 * 24 * 60) },
        { id: 'event-accept-george', actor: 'sitter', label: 'Request accepted', detail: 'The request was accepted.', createdAt: minutesAgo(21 * 24 * 60) },
        { id: 'event-request-george', actor: 'booker', label: 'Request received', detail: 'George sent a booking request.', createdAt: minutesAgo(22 * 24 * 60) },
      ],
    },
  ]
}

function createEventId() {
  return `event-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function findBooking(bookings: SitterWorkspaceBooking[], id: string): SitterWorkspaceBooking {
  const booking = bookings.find(item => item.id === id)
  if (!booking) throw new Error(`Sitter preview booking "${id}" was not found.`)
  return booking
}

export function useSitterWorkspace() {
  const profile = useState<SitterProfileDraft>('sitter-preview-profile', () => ({
    name: 'Thomas Rogers',
    location: 'Bristol, UK',
    bio: 'Thoughtful, reliable house sitter who loves getting to know the routines that make your pets feel at home. I work flexibly and can usually arrange a visit before the sit.',
    ratePence: 6800,
    rateBasis: 'per_night',
    acceptedPets: ['Dogs', 'Cats', 'Small animals'],
    phone: '07700 900 246',
    services: [{ id: 'service-walking', name: 'Dog walking', pricePence: 1200 }],
  }))
  const bookings = useState<SitterWorkspaceBooking[]>('sitter-preview-bookings', demoBookings)
  const unavailableBlocks = useState<SitterUnavailableBlock[]>('sitter-preview-unavailable', () => [
    { id: 'block-autumn-break', startDate: dateOffset(35), endDate: dateOffset(38), reason: 'Personal plans' },
  ])

  const pendingRequests = computed(() => bookings.value.filter(booking => booking.status === 'requested'))
  const upcomingBookings = computed(() =>
    bookings.value
      .filter(booking => ['accepted_times_pending', 'confirmed'].includes(booking.status) && booking.endDate >= dateOffset(0))
      .sort((a, b) => a.startDate.localeCompare(b.startDate)),
  )

  function updateStatus(id: string, status: SitterWorkspaceStatus, declineReason = '') {
    const booking = findBooking(bookings.value, id)
    booking.status = status
    booking.declineReason = declineReason
    booking.events.unshift({
      id: createEventId(),
      actor: 'sitter',
      label: status === 'declined' ? 'Request declined' : 'Request accepted',
      detail: status === 'declined' ? declineReason || 'No reason was added.' : 'Exact handover times still need agreement.',
      createdAt: new Date().toISOString(),
    })
  }

  function confirmHandoverTimes(id: string, arrivalTime: string, departureTime: string) {
    const booking = findBooking(bookings.value, id)
    booking.arrivalTime = arrivalTime
    booking.departureTime = departureTime
    booking.status = 'confirmed'
    booking.events.unshift({
      id: createEventId(),
      actor: 'sitter',
      label: 'Handover times agreed',
      detail: `Arrival ${arrivalTime}; departure ${departureTime}.`,
      createdAt: new Date().toISOString(),
    })
  }

  function cancelBooking(id: string, reason: string) {
    const booking = findBooking(bookings.value, id)
    booking.status = 'cancelled'
    booking.cancellationReason = reason
    booking.events.unshift({
      id: createEventId(),
      actor: 'sitter',
      label: 'Booking cancelled by sitter',
      detail: reason || 'No reason was added.',
      createdAt: new Date().toISOString(),
    })
  }

  function addExpense(id: string, expense: SitterWorkspaceExpense) {
    const booking = findBooking(bookings.value, id)
    booking.expenses.unshift(expense)
    booking.events.unshift({
      id: createEventId(),
      actor: 'sitter',
      label: 'Expense recorded',
      detail: `${expense.description} · ${formatMoney(expense.amountPence)}`,
      createdAt: expense.createdAt,
    })
  }

  function addPhoto(id: string, photo: SitterWorkspacePhoto) {
    const booking = findBooking(bookings.value, id)
    booking.photos.unshift(photo)
    booking.events.unshift({
      id: createEventId(),
      actor: 'sitter',
      label: 'Photo shared',
      detail: photo.fileName,
      createdAt: photo.createdAt,
    })
  }

  function removePhoto(id: string, photoId: string) {
    const booking = findBooking(bookings.value, id)
    const index = booking.photos.findIndex(photo => photo.id === photoId)
    if (index === -1) return
    const [photo] = booking.photos.splice(index, 1)
    if (!photo) return
    booking.events.unshift({
      id: createEventId(),
      actor: 'sitter',
      label: 'Photo removed',
      detail: photo.fileName,
      createdAt: new Date().toISOString(),
    })
    URL.revokeObjectURL(photo.url)
  }

  function addUpdate(id: string, update: SitterWorkspaceUpdate) {
    const booking = findBooking(bookings.value, id)
    booking.updates.unshift(update)
    booking.events.unshift({
      id: createEventId(),
      actor: 'sitter',
      label: 'Progress update posted',
      detail: update.message,
      createdAt: update.createdAt,
    })
  }

  function addUnavailableBlock(block: SitterUnavailableBlock) {
    unavailableBlocks.value.push(block)
  }

  function removeUnavailableBlock(id: string) {
    unavailableBlocks.value = unavailableBlocks.value.filter(block => block.id !== id)
  }

  function saveProfile(value: SitterProfileDraft) {
    profile.value = { ...value, acceptedPets: [...value.acceptedPets], services: value.services.map(service => ({ ...service })) }
  }

  return {
    profile,
    bookings,
    unavailableBlocks,
    pendingRequests,
    upcomingBookings,
    updateStatus,
    confirmHandoverTimes,
    cancelBooking,
    addExpense,
    addPhoto,
    removePhoto,
    addUpdate,
    addUnavailableBlock,
    removeUnavailableBlock,
    saveProfile,
  }
}
