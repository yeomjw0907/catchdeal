import { ipcMain, shell } from 'electron'
import { spawn } from 'child_process'
import path from 'path'
import os from 'os'
import { existsSync, mkdirSync } from 'fs'
import { fetchTradeLogs } from './supabase'

const CDP_PORT = 9222
/** 디버깅용 Chrome은 별도 프로필 사용 → 기존 Chrome이 떠 있어도 포트 9222가 열림 */
const CHROME_DEBUG_USER_DATA = path.join(os.tmpdir(), 'catchdeal-chrome-debug')

function getChromePath(): string | null {
  const win = process.platform === 'win32'
  if (win) {
    const local = process.env.LOCALAPPDATA
    const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files'
    const candidates = [
      local && path.join(local, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(programFiles + ' (x86)', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    ].filter(Boolean) as string[]
    for (const p of candidates) {
      try {
        if (existsSync(p)) return p
      } catch {
        // skip
      }
    }
  }
  return null
}

export function launchChromeWithDebug(): { ok: boolean; error?: string } {
  const chromePath = getChromePath()
  if (!chromePath) {
    return { ok: false, error: 'Chrome을 찾을 수 없습니다. Chrome을 설치해 주세요.' }
  }
  try {
    if (!existsSync(CHROME_DEBUG_USER_DATA)) {
      mkdirSync(CHROME_DEBUG_USER_DATA, { recursive: true })
    }
    spawn(chromePath, [
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${CHROME_DEBUG_USER_DATA}`,
      '--disable-extensions',
    ], {
      detached: true,
      stdio: 'ignore',
    }).unref()
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Chrome 실행 실패' }
  }
}

const SYNC_CHANNELS = ['sync:getTradeLogs', 'sync:openOrderPage', 'sync:openSalePage', 'sync:launchChromeWithDebug'] as const

export function registerSyncHandlers() {
  SYNC_CHANNELS.forEach((ch) => ipcMain.removeHandler(ch))
  ipcMain.handle('sync:getTradeLogs', async (_e, limit?: number) => {
    return fetchTradeLogs(limit ?? 100)
  })

  ipcMain.handle('sync:openOrderPage', (_e, url: string) => {
    if (url && url.startsWith('http')) shell.openExternal(url)
  })

  ipcMain.handle('sync:openSalePage', (_e, url: string) => {
    if (url && url.startsWith('http')) shell.openExternal(url)
  })

  ipcMain.handle('sync:launchChromeWithDebug', () => launchChromeWithDebug())
}
