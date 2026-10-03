import { chmod, mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { isAbsolute, relative, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'

export class PrivateFileStorage {
  private readonly directory: string

  constructor(directory = process.env.NESSIE_PRIVATE_UPLOAD_DIR ?? '.data/private-uploads') {
    this.directory = resolve(directory)
    for (const publicDirectory of [
      resolve(process.cwd(), 'public'),
      resolve(process.cwd(), '.output/public'),
    ]) {
      const pathFromPublic = relative(publicDirectory, this.directory)
      if (pathFromPublic === '' || (!pathFromPublic.startsWith('..') && !isAbsolute(pathFromPublic))) {
        throw new Error('NESSIE_PRIVATE_UPLOAD_DIR must not be inside a public assets directory')
      }
    }
  }

  async put(contents: Buffer): Promise<string> {
    await mkdir(this.directory, { recursive: true, mode: 0o700 })
    await chmod(this.directory, 0o700)
    const key = randomUUID()
    await writeFile(this.filePath(key), contents, { flag: 'wx', mode: 0o600 })
    return key
  }

  async get(key: string): Promise<Buffer> {
    return readFile(this.filePath(key))
  }

  async remove(key: string): Promise<void> {
    try {
      await unlink(this.filePath(key))
    }
    catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return
      throw error
    }
  }

  private filePath(key: string): string {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)) {
      throw new Error('Invalid private storage key')
    }
    return resolve(this.directory, key)
  }

}
