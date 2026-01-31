import { execSync } from 'child_process'
import { createHash } from 'crypto'
import { platform, hostname } from 'os'

export function getHWID(): string {
  try {
    if (platform() === 'win32') {
      const out = execSync('wmic csproduct get uuid', { encoding: 'utf8' })
      const uuid = out.replace(/[\r\n]/g, '').replace('UUID', '').trim()
      if (uuid) return createHash('sha256').update(uuid).digest('hex')
    }
    const fallback = `${platform()}-${hostname()}-${process.env.PROCESSOR_IDENTIFIER || 'unknown'}`
    return createHash('sha256').update(fallback).digest('hex')
  } catch {
    const fallback = `${platform()}-${Date.now()}-${Math.random()}`
    return createHash('sha256').update(fallback).digest('hex')
  }
}
