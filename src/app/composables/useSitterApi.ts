import type {
  AgreeTimesRequest, AvailabilityBlock, AvailabilityBlockInput, BookingAttachment, ProgressUpdateInput,
  SitterBooking, SitterExpense, SitterExpenseInput, SitterProfile, SitterProfileInput,
  DeclineBookingRequest, CancelBookingRequest,
} from '../../shared/types/booking.ts'

export function useSitterApi() {
  const base = '/api/sitters/current'
  const booking = (id: string) => `${base}/bookings/${encodeURIComponent(id)}`
  return {
    getProfile: () => $fetch<SitterProfile>(`${base}/profile`),
    updateProfile: (body: SitterProfileInput) => $fetch<SitterProfile>(`${base}/profile`, { method: 'PATCH', body }),
    listBlocks: () => $fetch<AvailabilityBlock[]>(`${base}/blocks`),
    createBlock: (body: AvailabilityBlockInput) => $fetch<AvailabilityBlock>(`${base}/blocks`, { method: 'POST', body }),
    updateBlock: (id: string, body: AvailabilityBlockInput) => $fetch<AvailabilityBlock>(`${base}/blocks/${encodeURIComponent(id)}`, { method: 'PATCH', body }),
    deleteBlock: (id: string) => $fetch<void>(`${base}/blocks/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    listBookings: () => $fetch<SitterBooking[]>(`${base}/bookings`),
    getBooking: (id: string) => $fetch<SitterBooking>(booking(id)),
    acceptBooking: (id: string) => $fetch<SitterBooking>(`${booking(id)}/accept`, { method: 'POST' }),
    declineBooking: (id: string, body: DeclineBookingRequest) => $fetch<SitterBooking>(`${booking(id)}/decline`, { method: 'POST', body }),
    agreeTimes: (id: string, body: AgreeTimesRequest) => $fetch<SitterBooking>(`${booking(id)}/times`, { method: 'POST', body }),
    cancelBooking: (id: string, body: CancelBookingRequest) => $fetch<SitterBooking>(`${booking(id)}/cancel`, { method: 'POST', body }),
    completeBooking: (id: string) => $fetch<SitterBooking>(`${booking(id)}/complete`, { method: 'POST' }),
    addProgressUpdate: (id: string, body: ProgressUpdateInput) =>
      $fetch(`${booking(id)}/updates`, { method: 'POST', body }),
    addExpense: (id: string, expense: SitterExpenseInput, receipt?: File) => {
      const body = new FormData()
      body.append('category', expense.category)
      body.append('description', expense.description)
      body.append('amount', String(expense.amount))
      if (receipt) body.append('file', receipt)
      return $fetch<SitterExpense>(`${booking(id)}/expenses`, { method: 'POST', body })
    },
    uploadReceipt: (id: string, expenseId: string, file: File) => {
      const body = new FormData()
      body.append('file', file)
      return $fetch<BookingAttachment>(`${booking(id)}/expenses/${encodeURIComponent(expenseId)}/receipt`, { method: 'POST', body })
    },
    uploadPhoto: (id: string, file: File, caption: string) => {
      const body = new FormData()
      body.append('file', file)
      body.append('caption', caption)
      return $fetch<BookingAttachment>(`${booking(id)}/attachments`, { method: 'POST', body })
    },
    deleteAttachment: (id: string, attachmentId: string) =>
      $fetch<void>(`${booking(id)}/attachments/${encodeURIComponent(attachmentId)}`, { method: 'DELETE' }),
  }
}
