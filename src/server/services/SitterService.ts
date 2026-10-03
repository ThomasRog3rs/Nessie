import type { Sitter, SitterProfile, SitterProfileInput } from '../../shared/types/booking.ts'
import { NotFoundError, ValidationError } from '../domain/errors.ts'
import type { SitterRepository } from '../repositories/contracts.ts'
import type { TransactionRunner } from '../repositories/contracts.ts'
import type { IdGenerator } from './ports.ts'

export class SitterService {
  private readonly sitters: SitterRepository
  private readonly transactions: TransactionRunner
  private readonly ids: IdGenerator

  constructor(sitters: SitterRepository, transactions: TransactionRunner, ids: IdGenerator) {
    this.sitters = sitters
    this.transactions = transactions
    this.ids = ids
  }

  getPreferredSitter(bookerId: string): Sitter {
    const sitter = this.sitters.findPreferredForBooker(bookerId)
    if (!sitter) throw new NotFoundError('No sitter is linked to this account')
    const { phone: _phone, ...publicSitter } = sitter
    return publicSitter
  }

  getCurrentProfile(sitterId: string): SitterProfile {
    const sitter = this.sitters.findById(sitterId)
    if (!sitter) throw new NotFoundError('Sitter profile not found')
    return { ...sitter, phone: sitter.phone ?? '' }
  }

  updateCurrentProfile(sitterId: string, input: SitterProfileInput): SitterProfile {
    return this.transactions.run(() => {
      const current = this.sitters.findById(sitterId)
      if (!current) throw new NotFoundError('Sitter profile not found')
      const currentIds = new Set(current.optionalServices.map(service => service.id))
      const submittedIds = input.optionalServices.flatMap(service => service.id ? [service.id] : [])
      if (new Set(submittedIds).size !== submittedIds.length
        || submittedIds.some(id => !currentIds.has(id))) {
        throw new ValidationError('The sitter profile is invalid', {
          optionalServices: ['Service identifiers must be unique services from this profile'],
        })
      }
      const acceptedPets = input.acceptedPets.map(pet => pet.trim())
      if (new Set(acceptedPets.map(pet => pet.toLowerCase())).size !== acceptedPets.length) {
        throw new ValidationError('The sitter profile is invalid', {
          acceptedPets: ['Pet types must be unique'],
        })
      }
      const optionalServices = input.optionalServices.map(service => ({
        ...service,
        id: service.id ?? this.ids.next(),
      }))
      this.sitters.updateProfile(sitterId, { ...input, acceptedPets, optionalServices })
      return this.getCurrentProfile(sitterId)
    })
  }
}
