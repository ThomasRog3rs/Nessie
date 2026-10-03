import type { BookingStatus } from '#shared/types/booking'

export const BOOKING_STATUS_META: Record<BookingStatus, {
  label: string
  icon: string
  color: 'neutral' | 'success' | 'warning' | 'error' | 'info' | 'primary'
  description: string
}> = {
  requested: { label: 'Requested', icon: 'i-lucide-hourglass', color: 'warning', description: 'Waiting for the sitter to accept or decline. No response does not change this status.' },
  declined: { label: 'Declined', icon: 'i-lucide-circle-x', color: 'error', description: 'The sitter declined this request.' },
  accepted_times_pending: { label: 'Accepted – times pending', icon: 'i-lucide-clock', color: 'info', description: 'Accepted. Exact arrival and departure times still need to be agreed.' },
  confirmed: { label: 'Confirmed', icon: 'i-lucide-circle-check', color: 'success', description: 'Dates and handover times are agreed.' },
  cancelled: { label: 'Cancelled', icon: 'i-lucide-ban', color: 'error', description: 'This booking was explicitly cancelled.' },
  completed: { label: 'Completed', icon: 'i-lucide-flag', color: 'neutral', description: 'The sit has finished.' },
}
