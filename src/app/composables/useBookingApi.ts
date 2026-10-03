import type { FetchError } from 'ofetch'

// Single place that talks to the booker-facing backend; swap endpoints here if the contract changes.
export function useBookingApi() {
  return {
    getSitter: () => $fetch<Sitter>('/api/sitters/current'),
    getAvailability: (from: string, to: string) =>
      $fetch<AvailabilityDay[]>('/api/sitters/current/availability', { query: { from, to } }),
    listBookings: () => $fetch<Booking[]>('/api/bookings'),
    getBooking: (id: string) => $fetch<BookerBooking>(`/api/bookings/${id}`),
    createBooking: (body: BookingRequest) =>
      $fetch<Booking>('/api/bookings', { method: 'POST', body }),
    cancelBooking: (id: string, body: CancelBookingRequest) =>
      $fetch<Booking>(`/api/bookings/${id}/cancel`, { method: 'POST', body }),
  }
}

type ApiFetchError = FetchError<{ statusMessage?: string, message?: string, data?: ApiErrorData }>

function asFetchError(error: unknown): ApiFetchError | undefined {
  return error instanceof Error && 'statusCode' in error ? error as ApiFetchError : undefined
}

/** Human-readable message for a failed API call, including per-field validation detail. */
export function apiErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const fetchError = asFetchError(error)
  const base = fetchError?.data?.statusMessage || fetchError?.data?.message || fetchError?.statusMessage
  const details = Object.values(fetchError?.data?.data?.fieldErrors ?? {}).flat()
  if (details.length > 0) return `${base ?? fallback}: ${details.join(' ')}`
  return base || fallback
}

export function isConflictError(error: unknown): boolean {
  return asFetchError(error)?.statusCode === 409
}
