// Single place that talks to the backend; swap endpoints here if the contract changes.
export function useBookingApi() {
  return {
    getSitter: () => $fetch<Sitter>('/api/sitters/current'),
    getAvailability: (from: string, to: string) =>
      $fetch<AvailabilityDay[]>('/api/sitters/current/availability', { query: { from, to } }),
    listBookings: () => $fetch<Booking[]>('/api/bookings'),
    getBooking: (id: string) => $fetch<Booking>(`/api/bookings/${id}`),
    createBooking: (body: BookingRequest) =>
      $fetch<Booking>('/api/bookings', { method: 'POST', body }),
    cancelBooking: (id: string, body: CancelBookingRequest) =>
      $fetch<Booking>(`/api/bookings/${id}/cancel`, { method: 'POST', body }),
  }
}

export function apiErrorMessage(e: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const err = e as { data?: { statusMessage?: string, message?: string }, statusMessage?: string }
  return err?.data?.statusMessage || err?.data?.message || err?.statusMessage || fallback
}
