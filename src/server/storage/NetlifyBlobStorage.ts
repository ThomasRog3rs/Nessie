import { randomUUID } from 'node:crypto'
import { getStore } from '@netlify/blobs'
import type { PrivateStorage } from './PrivateFileStorage.ts'

const KEY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Private uploads in Netlify Blobs: never publicly addressable, only served through authorised API routes. */
export class NetlifyBlobStorage implements PrivateStorage {
  private readonly store = getStore({ name: 'nessie-private-uploads', consistency: 'strong' })

  async put(contents: Buffer): Promise<string> {
    const key = randomUUID()
    await this.store.set(key, new Blob([contents as BlobPart]))
    return key
  }

  async get(key: string): Promise<Buffer> {
    this.assertKey(key)
    const data = await this.store.get(key, { type: 'arrayBuffer' })
    if (!data) throw Object.assign(new Error('Stored file not found'), { code: 'ENOENT' })
    return Buffer.from(data)
  }

  async remove(key: string): Promise<void> {
    this.assertKey(key)
    await this.store.delete(key)
  }

  private assertKey(key: string): void {
    if (!KEY_PATTERN.test(key)) throw new Error('Invalid private storage key')
  }
}
