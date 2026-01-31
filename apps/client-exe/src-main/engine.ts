import { ipcMain } from 'electron'
import { getSession } from './supabase'
import { getConfig } from './config'
import { getCoupangCookies } from './auth'
import { runScanner } from './scanner'
import type { EngineStatus, DailyStats } from '@catchdeal/shared'

let status: EngineStatus = 'idle'
let dailyStats: DailyStats = { scanCount: 0, purchaseCount: 0, date: new Date().toISOString().slice(0, 10) }
let abortController: AbortController | null = null

function getWebContents() {
  try {
    const { mainWindow } = require('./main')
    return mainWindow?.webContents
  } catch {
    return null
  }
}

function emitLog(line: string) {
  getWebContents()?.send('engine:log', line)
}

function setStatus(s: EngineStatus) {
  status = s
  getWebContents()?.send('engine:status', s)
}

function resetDailyIfNewDay() {
  const today = new Date().toISOString().slice(0, 10)
  if (dailyStats.date !== today) dailyStats = { scanCount: 0, purchaseCount: 0, date: today }
}

export function registerEngineHandlers() {
  ipcMain.handle('engine:start', async () => {
    if (status === 'scanning' || status === 'purchasing') return { ok: false, error: '이미 실행 중' }
    const session = getSession()
    if (!session) return { ok: false, error: '로그인이 필요합니다.' }
    const config = getConfig()
    if (!config.sectors?.length) return { ok: false, error: '감시할 카테고리를 설정해 주세요.' }
    const cookies = getCoupangCookies()
    if (!cookies.length) return { ok: false, error: '쿠팡 로그인을 먼저 진행해 주세요.' }
    abortController = new AbortController()
    resetDailyIfNewDay()
    setStatus('scanning')
    runScanner({
      config,
      cookies,
      accessToken: session.access_token,
      userId: session.user.id,
      onLog: emitLog,
      onStatus: setStatus,
      onScan: () => { dailyStats.scanCount++ },
      onPurchase: () => { dailyStats.purchaseCount++ },
      signal: abortController.signal,
    }).then(() => setStatus('idle')).catch((e) => {
      emitLog(`오류: ${e.message}`)
      setStatus('error')
    })
    return { ok: true }
  })

  ipcMain.handle('engine:stop', () => {
    if (abortController) {
      abortController.abort()
      abortController = null
    }
    setStatus('stopped')
    return { ok: true }
  })

  ipcMain.handle('engine:getStatus', () => status)
  ipcMain.handle('engine:getDailyStats', () => {
    resetDailyIfNewDay()
    return dailyStats
  })
}

export function getEngineStatus(): EngineStatus {
  return status
}

export function getDailyStatsExport(): DailyStats {
  return { ...dailyStats }
}
