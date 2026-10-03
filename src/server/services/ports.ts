export interface Clock {
  now(): Date
}

export interface IdGenerator {
  next(): string
}

export const systemClock: Clock = { now: () => new Date() }
export const uuidGenerator: IdGenerator = { next: () => crypto.randomUUID() }

/** Identifies who is acting; the mock implementation is replaced when authentication lands. */
export interface CurrentActorProvider {
  bookerId(): string
  sitterId(): string
}
