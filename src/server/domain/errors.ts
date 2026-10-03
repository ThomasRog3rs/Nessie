import type { ApiErrorCode } from '../../shared/types/booking.ts'

export abstract class DomainError extends Error {
  abstract readonly code: ApiErrorCode
}

export class NotFoundError extends DomainError {
  readonly code = 'not_found'
}

export class UnauthorizedError extends DomainError {
  readonly code = 'unauthorized'
}

export class ForbiddenError extends DomainError {
  readonly code = 'forbidden'
}

/** The resource existed but can no longer be used (e.g. a spent invite link). */
export class GoneError extends DomainError {
  readonly code = 'gone'
}

export class ConflictError extends DomainError {
  readonly code = 'conflict'
}

export class InvalidTransitionError extends DomainError {
  readonly code = 'invalid_transition'
}

export class ValidationError extends DomainError {
  readonly code = 'validation_failed'
  readonly fieldErrors: Record<string, string[]>

  constructor(message: string, fieldErrors: Record<string, string[]> = {}) {
    super(message)
    this.fieldErrors = fieldErrors
  }
}
