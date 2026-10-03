import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PrivateFileStorage } from '../server/storage/PrivateFileStorage.ts'
import { MAX_ATTACHMENT_BYTES, validateUploadedFile } from '../server/utils/uploads.ts'

describe('private booking attachment support', () => {
  it('validates upload type, file signature, and the 10 MiB limit', () => {
    const pdf = Buffer.from('%PDF-1.7')
    expect(validateUploadedFile(pdf, 'receipt.pdf', 'application/pdf', ['application/pdf']))
      .toMatchObject({ fileName: 'receipt.pdf', mimeType: 'application/pdf' })
    expect(() => validateUploadedFile(Buffer.from('not a pdf'), 'receipt.pdf', 'application/pdf', ['application/pdf']))
      .toThrow(/contents do not match/)
    expect(() => validateUploadedFile(Buffer.alloc(MAX_ATTACHMENT_BYTES + 1), 'large.pdf', 'application/pdf', ['application/pdf']))
      .toThrow(/size is invalid/)
    expect(() => validateUploadedFile(pdf, 'receipt.svg', 'image/svg+xml', ['application/pdf']))
      .toThrow(/type is not supported/)
  })

  it('stores files outside public assets with private permissions and opaque keys', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'nesse-private-'))
    try {
      const storage = new PrivateFileStorage(directory)
      const contents = Buffer.from('private receipt')
      const key = await storage.put(contents)
      expect(key).toMatch(/^[0-9a-f-]{36}$/i)
      expect(await storage.get(key)).toEqual(contents)
      expect((await stat(join(directory, key))).mode & 0o777).toBe(0o600)
      expect((await stat(directory)).mode & 0o777).toBe(0o700)
      await storage.remove(key)
      await expect(storage.get(key)).rejects.toMatchObject({ code: 'ENOENT' })
      expect(() => new PrivateFileStorage(resolve(process.cwd(), 'public', 'uploads'))).toThrow(/public assets/)
    }
    finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})
