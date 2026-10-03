import type { Sitter } from '../../shared/types/booking.ts'
import { NotFoundError } from '../domain/errors.ts'
import type { SitterRepository } from '../repositories/contracts.ts'

export class SitterService {
  private readonly sitters: SitterRepository

  constructor(sitters: SitterRepository) {
    this.sitters = sitters
  }

  getPreferredSitter(bookerId: string): Sitter {
    const sitter = this.sitters.findPreferredForBooker(bookerId)
    if (!sitter) throw new NotFoundError('No sitter is linked to this account')
    return sitter
  }
}
