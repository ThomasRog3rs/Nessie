import { basename } from 'node:path'
import type { H3Event } from 'h3'
import { ValidationError } from '../domain/errors.ts'

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024

const SIGNATURES: Record<string, (bytes: Buffer) => boolean> = {
  'application/pdf': bytes => bytes.subarray(0, 5).toString('ascii') === '%PDF-',
  'image/jpeg': bytes => bytes.length >= 3 && bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF,
  'image/png': bytes => bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])),
  'image/webp': bytes => bytes.length >= 12
    && bytes.subarray(0, 4).toString('ascii') === 'RIFF'
    && bytes.subarray(8, 12).toString('ascii') === 'WEBP',
}

export interface UploadedFile {
  contents: Buffer
  fileName: string
  mimeType: string
}

export async function readUpload(event: H3Event, allowedTypes: readonly string[]): Promise<{
  fields: Map<string, string>
  file: UploadedFile
}> {
  const result = await readMultipartUpload(event, allowedTypes)
  if (!result.file) throw new ValidationError('Choose a file to upload', { file: ['A file is required'] })
  return { fields: result.fields, file: result.file }
}

export async function readMultipartUpload(event: H3Event, allowedTypes: readonly string[]): Promise<{
  fields: Map<string, string>
  file?: UploadedFile
}> {
  const parts = await readMultipartFormData(event)
  if (!parts) throw new ValidationError('Choose a file to upload', { file: ['A file is required'] })
  const fields = new Map<string, string>()
  let upload: UploadedFile | undefined
  for (const part of parts) {
    if (part.filename !== undefined) {
      if (upload) throw new ValidationError('Upload one file at a time', { file: ['Only one file is allowed'] })
      upload = validateUploadedFile(part.data, part.filename, part.type ?? '', allowedTypes)
    }
    else if (part.name) {
      fields.set(part.name, part.data.toString('utf8'))
    }
  }
  return { fields, ...(upload ? { file: upload } : {}) }
}

export function validateUploadedFile(contents: Buffer, filename: string, mimeType: string, allowedTypes: readonly string[]): UploadedFile {
  if (!allowedTypes.includes(mimeType)) {
    throw new ValidationError('The file type is not supported', {
      file: [`Supported file types: ${allowedTypes.join(', ')}`],
    })
  }
  if (contents.length === 0 || contents.length > MAX_ATTACHMENT_BYTES) {
    throw new ValidationError('The file size is invalid', { file: ['Files must be larger than zero and no larger than 10 MB'] })
  }
  if (!SIGNATURES[mimeType]?.(contents)) {
    throw new ValidationError('The file contents do not match the declared type', {
      file: ['The uploaded file is not a valid file of the selected type'],
    })
  }
  const providedName = basename(filename.replaceAll('\\', '/')).replace(/[\u0000-\u001F\u007F]/g, '').slice(0, 180)
  return { contents, fileName: providedName || 'upload', mimeType }
}
