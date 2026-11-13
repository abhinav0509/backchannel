import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// The key is a hash of the whole request, so any change to a prompt, model or schema misses
// and invalidates only its own entries. Prompts carry the company domain and today's date.
export const cacheKey = (value: unknown): string => createHash('sha256').update(JSON.stringify(value)).digest('hex')

export function readCache<T>(dir: string, key: string): T | undefined {
  const file = join(dir, `${key}.json`)
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as T) : undefined
}

export function writeCache(dir: string, key: string, value: unknown): void {
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, `${key}.json`), JSON.stringify(value))
}
