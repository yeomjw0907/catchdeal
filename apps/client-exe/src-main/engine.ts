import { ipcMain, BrowserWindow } from 'electron'
import { getSession } from './supabase'
import { getConfig } from './config'
import { getCoupangCookies } from './auth'
import { runCafeScanner } from './cafe'
import type { EngineStatus, DailyStats, ExtractedLinkItem } from '@catchdeal/shared'

let status: EngineStatus = 'idle'
let dailyStats: DailyStats = { scanCount: 0, purchaseCount: 0, date: new Date().toISOString().slice(0, 10) }
let abortController: AbortController | null = null
let engineRunning = false

const EXTRACTED_LINKS_MAX = 300
const extractedLinks: ExtractedLinkItem[] = []

function addExtractedLink(url: string, postTitle?: string) {
  const item: ExtractedLinkItem = {
    url,
    postTitle,
    extractedAt: Date.now(),
    status: 'pending',
  }
  extractedLinks.push(item)
  if (extractedLinks.length > EXTRACTED_LINKS_MAX) extractedLinks.shift()
  sendToAllWindows('engine:extractedLinks', item)
}

function findPendingIndex(url: string): number {
  for (let i = extractedLinks.length - 1; i >= 0; i--) {
    if (extractedLinks[i].url === url && extractedLinks[i].status === 'pending') return i
  }
  return -1
}

function onLinkEnriched(url: string, postTitle: string | undefined, productInfo: { productName: string; price: number; originalPrice?: number; discountRate?: number }) {
  const i = findPendingIndex(url)
  if (i >= 0) {
    Object.assign(extractedLinks[i], {
      status: 'success' as const,
      productName: productInfo.productName,
      price: productInfo.price,
      originalPrice: productInfo.originalPrice,
      discountRate: productInfo.discountRate,
    })
    sendToAllWindows('engine:extractedLinkUpdated', extractedLinks[i])
  }
}

function onLinkFailed(url: string, postTitle: string | undefined, errorMessage: string) {
  const i = findPendingIndex(url)
  if (i >= 0) {
    const item = extractedLinks[i]
    Object.assign(item, {
      status: 'failed' as const,
      failedAt: Date.now(),
      errorMessage,
    })
    sendToAllWindows('engine:extractedLinkUpdated', item)
  }
  emitLog(`해부 실패: ${url.slice(0, 50)}… — ${errorMessage}`)
}

/** 모든 창에 로그/상태 전송 (창이 여러 개여도 사용자가 보는 창에서 로그가 보이도록) */
function sendToAllWindows(channel: string, ...args: unknown[]) {
  BrowserWindow.getAllWindows().forEach((w) => {
    if (!w.isDestroyed() && w.webContents && !w.webContents.isDestroyed()) {
      w.webContents.send(channel, ...args)
    }
  })
}

function emitLog(line: string) {
  sendToAllWindows('engine:log', line)
}

function setStatus(s: EngineStatus) {
  status = s
  sendToAllWindows('engine:status', s)
}

function resetDailyIfNewDay() {
  const today = new Date().toISOString().slice(0, 10)
  if (dailyStats.date !== today) dailyStats = { scanCount: 0, purchaseCount: 0, date: today }
}

const CDP_PORT = 9222

async function getCdpWsEndpoint(): Promise<string | null> {
  const maxAttempts = 5
  const delayMs = 1500
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`, { signal: AbortSignal.timeout(3000) })
      if (!res.ok) throw new Error('not ok')
      const data = (await res.json()) as { webSocketDebuggerUrl?: string }
      const url = data.webSocketDebuggerUrl ?? null
      if (url) return url
    } catch {
      // Chrome이 포트를 열기까지 1~2초 걸릴 수 있음
    }
    if (i < maxAttempts - 1) {
      await new Promise((r) => setTimeout(r, delayMs))
    }
  }
  return null
}

const ENGINE_CHANNELS = ['engine:start', 'engine:stop', 'engine:getStatus', 'engine:getDailyStats', 'engine:getExtractedLinks'] as const

export function registerEngineHandlers() {
  ENGINE_CHANNELS.forEach((ch) => ipcMain.removeHandler(ch))
  ipcMain.handle('engine:start', async () => {
    if (engineRunning || status === 'scanning' || status === 'purchasing') {
      return { ok: false, error: '이미 실행 중' }
    }
    engineRunning = true
    setStatus('scanning')
    const session = getSession()
    if (!session) {
      engineRunning = false
      setStatus('idle')
      emitLog('오류: 로그인이 필요합니다.')
      return { ok: false, error: '로그인이 필요합니다.' }
    }
    const config = getConfig()
    const cafeSources = (config.cafeSources || []).filter((s) => s.enabled && s.cafeListUrl?.trim() && s.keyword?.trim())
    if (!cafeSources.length) {
      engineRunning = false
      setStatus('idle')
      emitLog('오류: 감시할 카페를 설정해 주세요. (환경설정 → 카페 소스)')
      return { ok: false, error: '감시할 카페를 설정해 주세요.' }
    }
    const cookies = getCoupangCookies()
    if (!cookies.length) {
      engineRunning = false
      setStatus('idle')
      emitLog('오류: 쿠팡 로그인을 먼저 진행해 주세요.')
      return { ok: false, error: '쿠팡 로그인을 먼저 진행해 주세요.' }
    }
    const cdpWsEndpoint = await getCdpWsEndpoint()
    if (!cdpWsEndpoint) {
      engineRunning = false
      setStatus('idle')
      emitLog('Chrome 디버깅 모드에 연결할 수 없습니다. 환경설정에서 [Chrome 디버깅 모드로 실행] 후 다시 Start를 누르세요.')
      return { ok: false, error: 'Chrome 디버깅 모드로 실행해 주세요. (환경설정 참고)' }
    }

    abortController = new AbortController()
    resetDailyIfNewDay()
    emitLog('카페 스캐너를 시작합니다...')
    runCafeScanner({
      config,
      onLog: emitLog,
      onStatus: setStatus,
      onScan: () => { dailyStats.scanCount++ },
      onLinkExtracted: addExtractedLink,
      onLinkEnriched,
      onLinkFailed,
      signal: abortController.signal,
      cdpWsEndpoint,
    })
      .then(() => {
        setStatus('idle')
        engineRunning = false
      })
      .catch((e) => {
        emitLog(`오류: ${e.message}`)
        setStatus('error')
        engineRunning = false
      })
    return { ok: true }
  })

  ipcMain.handle('engine:stop', () => {
    if (abortController) {
      abortController.abort()
      abortController = null
    }
    setStatus('stopped')
    engineRunning = false
    return { ok: true }
  })

  ipcMain.handle('engine:getStatus', () => status)
  ipcMain.handle('engine:getDailyStats', () => {
    resetDailyIfNewDay()
    return dailyStats
  })
  ipcMain.handle('engine:getExtractedLinks', () => [...extractedLinks])
}

export function getEngineStatus(): EngineStatus {
  return status
}

export function getDailyStatsExport(): DailyStats {
  return { ...dailyStats }
}
