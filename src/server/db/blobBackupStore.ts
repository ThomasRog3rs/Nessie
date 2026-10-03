import { getStore } from '@netlify/blobs'
import type { BackupManifest, BackupRecord, BackupStore } from './backup.ts'

const DATA_PREFIX = 'data/'
const MANIFEST_PREFIX = 'manifest/'

/** Durable backups in Netlify Blobs. The manifest is written last, so a listed backup is always complete. */
export class NetlifyBlobBackupStore implements BackupStore {
  private readonly store = getStore({ name: 'nessie-backups', consistency: 'strong' })

  async put(name: string, contents: Uint8Array, manifest: BackupManifest): Promise<void> {
    await this.store.set(`${DATA_PREFIX}${name}`, new Blob([contents as BlobPart]))
    await this.store.setJSON(`${MANIFEST_PREFIX}${name}`, manifest)
  }

  async get(name: string): Promise<BackupRecord | null> {
    const [data, manifest] = await Promise.all([
      this.store.get(`${DATA_PREFIX}${name}`, { type: 'arrayBuffer' }),
      this.store.get(`${MANIFEST_PREFIX}${name}`, { type: 'json' }) as Promise<BackupManifest | null>,
    ])
    if (!data || !manifest) return null
    return { manifest, contents: new Uint8Array(data) }
  }

  async list(): Promise<BackupManifest[]> {
    const { blobs } = await this.store.list({ prefix: MANIFEST_PREFIX })
    const manifests = await Promise.all(blobs.map(blob => this.store.get(blob.key, { type: 'json' }) as Promise<BackupManifest | null>))
    return manifests.filter((m): m is BackupManifest => m !== null).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async delete(name: string): Promise<void> {
    await this.store.delete(`${MANIFEST_PREFIX}${name}`)
    await this.store.delete(`${DATA_PREFIX}${name}`)
  }
}
