import type {
  AvailabilityBlock, BookingAttachment, SitterBooking, SitterExpense, SitterProfile,
} from '../../shared/types/booking.ts'

export type SitterWorkspaceStatus = SitterBooking['status']
export type SitterExpenseCategory = 'travel' | 'incidental'

export interface SitterProfileDraft {
  name: string
  location: string
  bio: string
  ratePence: number
  rateBasis: 'per_night' | 'per_day'
  acceptedPets: string[]
  phone: string
  services: { id?: string, name: string, pricePence: number }[]
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
  receiptUrl?: string
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
  timezone: string
  startDate: string
  endDate: string
  arrivalTime: string
  departureTime: string
  requestedArrivalTime: string
  requestedDepartureTime: string
  agreedArrivalTime: string | null
  agreedDepartureTime: string | null
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

export type SitterUnavailableBlock = AvailabilityBlock

interface WorkspaceData {
  profile: SitterProfile
  bookings: SitterBooking[]
  unavailableBlocks: AvailabilityBlock[]
}

async function loadWorkspace(): Promise<WorkspaceData> {
  const [profile, bookings, unavailableBlocks] = await Promise.all([
    $fetch<SitterProfile>('/api/sitters/current/profile'),
    $fetch<SitterBooking[]>('/api/sitters/current/bookings'),
    $fetch<AvailabilityBlock[]>('/api/sitters/current/blocks'),
  ])
  return { profile, bookings, unavailableBlocks }
}

function toProfileDraft(profile?: SitterProfile): SitterProfileDraft {
  return {
    name: profile?.name ?? '',
    location: profile?.location ?? '',
    bio: profile?.bio ?? '',
    ratePence: profile?.rate ?? 0,
    rateBasis: profile?.rateBasis ?? 'per_night',
    acceptedPets: profile?.acceptedPets ?? [],
    phone: profile?.phone ?? '',
    services: profile?.optionalServices.map(service => ({
      id: service.id,
      name: service.name,
      pricePence: service.price,
    })) ?? [],
  }
}

function eventLabel(type: string): string {
  const labels: Record<string, string> = {
    requested: 'Request received',
    accepted: 'Request accepted',
    declined: 'Request declined',
    times_proposed: 'Handover times proposed',
    times_agreed: 'Handover times agreed',
    changed: 'Booking changed',
    cancelled: 'Booking cancelled',
    completed: 'Sit completed',
    progress_update: 'Progress update posted',
    expense_recorded: 'Expense recorded',
    photo_added: 'Photo shared',
    receipt_added: 'Receipt added',
    attachment_removed: 'Attachment removed',
  }
  return labels[type] ?? type
}

function mapBooking(booking: SitterBooking): SitterWorkspaceBooking {
  const history = booking.history
  const declined = [...history].reverse().find(event => event.type === 'declined')
  const cancelled = [...history].reverse().find(event => event.type === 'cancelled')
  const services = booking.services.map(service => service.name)
  const attachments = booking.attachments
  return {
    id: booking.id,
    bookerName: booking.bookerName,
    bookerInitials: booking.bookerName.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase(),
    requestedAt: booking.createdAt,
    timezone: booking.timezone,
    startDate: booking.startDate,
    endDate: booking.endDate,
    arrivalTime: booking.agreedArrivalTime ?? booking.arrivalTime,
    departureTime: booking.agreedDepartureTime ?? booking.departureTime,
    requestedArrivalTime: booking.arrivalTime,
    requestedDepartureTime: booking.departureTime,
    agreedArrivalTime: booking.agreedArrivalTime,
    agreedDepartureTime: booking.agreedDepartureTime,
    status: booking.status,
    pets: booking.pets,
    careNotes: booking.careNotes,
    propertyNotes: booking.propertyInstructions ?? '',
    services,
    requestedTravelPence: booking.travelReimbursement.amount,
    requestedIncidentals: booking.incidentalExpenses.map(expense => ({
      description: expense.description,
      amountPence: expense.amount,
    })),
    emergencyContact: booking.emergencyContact ?? { name: '', relationship: '', phone: '' },
    vet: booking.vet ?? { name: '', phone: '' },
    emergencyInstructions: booking.emergencyInstructions ?? '',
    alternativeCareTermAcknowledged: booking.cancellationTermAcknowledged,
    declineReason: declined?.message.replace(/^Request declined:\s*/, '').replace(/^Request declined\.$/, '') ?? '',
    cancellationReason: cancelled?.message ?? '',
    expenses: booking.sitterExpenses.map((expense: SitterExpense) => ({
      id: expense.id,
      category: expense.category,
      description: expense.description,
      amountPence: expense.amount,
      fileName: expense.receipt?.fileName ?? '',
      ...(expense.receipt ? {
        receiptUrl: `/api/sitters/current/bookings/${booking.id}/attachments/${expense.receipt.id}`,
      } : {}),
      createdAt: expense.createdAt,
    })),
    photos: attachments.filter(file => file.kind === 'photo').map((photo: BookingAttachment) => ({
      id: photo.id,
      url: `/api/sitters/current/bookings/${booking.id}/attachments/${photo.id}`,
      fileName: photo.fileName,
      caption: photo.caption ?? '',
      createdAt: photo.createdAt,
    })),
    updates: booking.progressUpdates.map(update => ({
      id: update.id,
      message: update.message,
      createdAt: update.createdAt,
    })),
    events: history.map(event => ({
      id: event.id,
      actor: event.actor,
      label: eventLabel(event.type),
      detail: event.message,
      createdAt: event.at,
    })),
  }
}

export function useSitterWorkspace() {
  const api = useSitterApi()
  const { data, pending, error, refresh } = useAsyncData('sitter-workspace', loadWorkspace)

  const profile = computed(() => toProfileDraft(data.value?.profile))
  const bookings = computed(() => data.value?.bookings.map(mapBooking) ?? [])
  const unavailableBlocks = computed(() => data.value?.unavailableBlocks ?? [])
  const pendingRequests = computed(() => bookings.value.filter(booking => booking.status === 'requested'))
  const upcomingBookings = computed(() => bookings.value
    .filter(booking => ['accepted_times_pending', 'confirmed'].includes(booking.status))
    .sort((a, b) => a.startDate.localeCompare(b.startDate)))

  async function updateStatus(id: string, status: SitterWorkspaceStatus, declineReason = '') {
    if (status === 'accepted_times_pending') await api.acceptBooking(id)
    else if (status === 'declined') await api.declineBooking(id, { reason: declineReason })
    else throw new Error(`Unsupported sitter request decision: ${status}`)
    await refresh()
  }

  async function confirmHandoverTimes(id: string, arrivalTime: string, departureTime: string) {
    await api.agreeTimes(id, { arrivalTime, departureTime })
    await refresh()
  }

  async function cancelBooking(id: string, reason: string) {
    await api.cancelBooking(id, { reason })
    await refresh()
  }

  async function addExpense(
    id: string,
    expense: { category: SitterExpenseCategory, description: string, amountPence: number },
    receipt?: File,
  ) {
    const saved = await api.addExpense(id, {
      category: expense.category,
      description: expense.description,
      amount: expense.amountPence,
    }, receipt)
    await refresh()
    return saved
  }

  async function addPhotos(id: string, files: File[], caption: string) {
    for (const file of files) await api.uploadPhoto(id, file, caption)
    await refresh()
  }

  async function removePhoto(id: string, photoId: string) {
    await api.deleteAttachment(id, photoId)
    await refresh()
  }

  async function addUpdate(id: string, update: { message: string, date?: string }) {
    await api.addProgressUpdate(id, update)
    await refresh()
  }

  async function completeBooking(id: string) {
    await api.completeBooking(id)
    await refresh()
  }

  async function addUnavailableBlock(block: Omit<AvailabilityBlock, 'id'>) {
    await api.createBlock(block)
    await refresh()
  }

  async function removeUnavailableBlock(id: string) {
    await api.deleteBlock(id)
    await refresh()
  }

  async function saveProfile(value: SitterProfileDraft) {
    await api.updateProfile({
      name: value.name,
      location: value.location,
      bio: value.bio,
      phone: value.phone,
      rate: value.ratePence,
      rateBasis: value.rateBasis,
      acceptedPets: value.acceptedPets,
      optionalServices: value.services.map(service => ({
        id: service.id,
        name: service.name,
        price: service.pricePence,
      })),
    })
    await refresh()
  }

  return {
    profile,
    bookings,
    unavailableBlocks,
    pendingRequests,
    upcomingBookings,
    pending,
    error,
    refresh,
    updateStatus,
    confirmHandoverTimes,
    cancelBooking,
    completeBooking,
    addExpense,
    addPhotos,
    removePhoto,
    addUpdate,
    addUnavailableBlock,
    removeUnavailableBlock,
    saveProfile,
  }
}
