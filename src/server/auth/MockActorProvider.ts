import { SEED_BOOKER_ID, SEED_SITTER_ID } from '../db/seed.ts'
import type { CurrentActorProvider } from '../services/ports.ts'

/** Stand-in until authentication exists: everyone is the seeded booker, and the sitter is Thomas Rogers. */
export class MockActorProvider implements CurrentActorProvider {
  bookerId(): string {
    return SEED_BOOKER_ID
  }

  sitterId(): string {
    return SEED_SITTER_ID
  }
}
