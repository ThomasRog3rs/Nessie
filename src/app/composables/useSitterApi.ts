// Sitter-side endpoints. Unauthenticated for now; scoped server-side to the current sitter.
export function useSitterApi() {
  const base = '/api/sitters/current'
  return {
    listBlocks: () => $fetch<AvailabilityBlock[]>(`${base}/blocks`),
    createBlock: (body: AvailabilityBlockInput) => $fetch<AvailabilityBlock>(`${base}/blocks`, { method: 'POST', body }),
    updateBlock: (id: string, body: AvailabilityBlockInput) => $fetch<AvailabilityBlock>(`${base}/blocks/${id}`, { method: 'PATCH', body }),
    deleteBlock: (id: string) => $fetch<void>(`${base}/blocks/${id}`, { method: 'DELETE' }),
    listBookings: () => $fetch<Booking[]>(`${base}/bookings`),
    acceptBooking: (id: string) => $fetch<Booking>(`${base}/bookings/${id}/accept`, { method: 'POST' }),
    declineBooking: (id: string, body: DeclineBookingRequest) => $fetch<Booking>(`${base}/bookings/${id}/decline`, { method: 'POST', body }),
    agreeTimes: (id: string, body: AgreeTimesRequest) => $fetch<Booking>(`${base}/bookings/${id}/times`, { method: 'POST', body }),
    cancelBooking: (id: string, body: CancelBookingRequest) => $fetch<Booking>(`${base}/bookings/${id}/cancel`, { method: 'POST', body }),
    completeBooking: (id: string) => $fetch<Booking>(`${base}/bookings/${id}/complete`, { method: 'POST' }),
  }
}
