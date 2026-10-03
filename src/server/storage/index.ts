import { NetlifyBlobStorage } from './NetlifyBlobStorage.ts'
import { PrivateFileStorage } from './PrivateFileStorage.ts'
import type { PrivateStorage } from './PrivateFileStorage.ts'

/** Local disk by default; Netlify Blobs when NESSIE_STORAGE=netlify-blobs (production). */
export function createPrivateStorage(): PrivateStorage {
  return process.env.NESSIE_STORAGE === 'netlify-blobs' ? new NetlifyBlobStorage() : new PrivateFileStorage()
}
