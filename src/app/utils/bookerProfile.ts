export function emptyBookerProfile(): BookerProfileInput {
  return {
    name: '',
    phone: '',
    addressLine: '',
    city: '',
    postcode: '',
    emergencyContact: { name: '', phone: '', relationship: '' },
    vet: { name: '', phone: '' },
    emergencyInstructions: '',
    propertyInstructions: '',
    pets: [],
  }
}
