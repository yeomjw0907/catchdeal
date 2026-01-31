import { ipcMain } from 'electron'
import Store from 'electron-store'
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'
import type { AppConfig, FilterConfig, SectorConfig, CafeSourceConfig } from '@catchdeal/shared'

const DEFAULT_MIN_PRICE = 100_000
const DEFAULT_DISCOUNT_RATE = 50
const KEY_LEN = 32
const IV_LEN = 16
const SALT = 'catch-deal-payment-v1'

function deriveKey(password: string): Buffer {
  return scryptSync(password, SALT, KEY_LEN)
}

function encrypt(text: string, password: string): string {
  const key = deriveKey(password)
  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv('aes-256-cbc', key, iv)
  const enc = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  return iv.toString('hex') + ':' + enc.toString('hex')
}

function decrypt(encrypted: string, password: string): string {
  const [ivHex, dataHex] = encrypted.split(':')
  if (!ivHex || !dataHex) return ''
  const key = deriveKey(password)
  const iv = Buffer.from(ivHex, 'hex')
  const decipher = createDecipheriv('aes-256-cbc', key, iv)
  return decipher.update(Buffer.from(dataHex, 'hex')) + decipher.final('utf8')
}

const store = new Store<{ config?: AppConfig; paymentEncrypted?: string }>({ name: 'catch-deal-config' })

const defaultFilter: FilterConfig = {
  minPrice: DEFAULT_MIN_PRICE,
  targetDiscountRate: DEFAULT_DISCOUNT_RATE,
  excludeKeywords: ['케이스', '반품', '리퍼'],
}

function getDefaultConfig(): AppConfig {
  return {
    sectors: [] as SectorConfig[],
    cafeSources: [] as CafeSourceConfig[],
    filter: { ...defaultFilter },
    paymentPasswordEncrypted: null,
  }
}

export function getConfig(): AppConfig {
  const saved = store.get('config')
  const defaults = getDefaultConfig()
  if (!saved) return defaults
  return {
    ...defaults,
    ...saved,
    cafeSources: saved.cafeSources ?? defaults.cafeSources,
    filter: { ...defaultFilter, ...saved.filter },
  }
}

export function setConfig(config: Partial<AppConfig>) {
  const current = getConfig()
  const next: AppConfig = {
    sectors: config.sectors ?? current.sectors,
    cafeSources: config.cafeSources ?? current.cafeSources,
    filter: { ...current.filter, ...config.filter },
    paymentPasswordEncrypted: config.paymentPasswordEncrypted ?? current.paymentPasswordEncrypted,
  }
  store.set('config', next)
  return next
}

export function setPaymentPassword(password: string) {
  if (!password || password.length !== 6) return false
  const encrypted = encrypt(password, SALT + process.env.SUPABASE_ANON_KEY || 'catch-deal-secret')
  const c = getConfig()
  c.paymentPasswordEncrypted = encrypted
  store.set('config', c)
  return true
}

export function getPaymentPasswordDecrypted(): string | null {
  const enc = getConfig().paymentPasswordEncrypted ?? store.get('paymentEncrypted')
  if (!enc) return null
  try {
    return decrypt(enc, SALT + (process.env.SUPABASE_ANON_KEY || 'catch-deal-secret'))
  } catch {
    return null
  }
}

const CONFIG_CHANNELS = ['config:get', 'config:set', 'config:setPaymentPassword'] as const

export function registerConfigHandlers() {
  CONFIG_CHANNELS.forEach((ch) => ipcMain.removeHandler(ch))
  ipcMain.handle('config:get', () => getConfig())
  ipcMain.handle('config:set', (_e, config: Partial<AppConfig>) => setConfig(config))
  ipcMain.handle('config:setPaymentPassword', (_e, password: string) => setPaymentPassword(password))
}
