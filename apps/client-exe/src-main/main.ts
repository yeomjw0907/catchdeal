import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import { config as loadEnv } from 'dotenv'

// 동일 앱이 여러 프로세스로 뜨는 것 방지 (Vite 빌드 시 창 3개 등)
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
  process.exit(0)
}

// Electron 메인 프로세스에서 .env 로드 (Vite가 process.env에 주입하지 않음)
const envPaths = [
  path.join(__dirname, '../.env'),
  path.join(process.cwd(), '.env'),
  path.join(process.cwd(), 'apps', 'client-exe', '.env'),
]
for (const p of envPaths) {
  loadEnv({ path: p })
  if (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL) break
}

import { registerAuthHandlers } from './auth'
import { registerCafeHandlers } from './cafe'
import { registerConfigHandlers } from './config'
import { registerEngineHandlers } from './engine'
import { registerSyncHandlers } from './sync'

export let mainWindow: BrowserWindow | null = null
let appStartTime = 0

function createWindow() {
  // 이미 창이 있으면 새로 만들지 않고 포커스만 (Vite HMR/빌드 시 createWindow 중복 호출 방지)
  const existing = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed())
  if (existing) {
    mainWindow = existing
    existing.show()
    existing.focus()
    return
  }

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    title: 'CatchDeal',
    show: false,
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.on('closed', () => { mainWindow = null })
}

let readyDone = false
app.whenReady().then(() => {
  if (readyDone) return
  readyDone = true
  appStartTime = Date.now()
  registerAuthHandlers()
  registerConfigHandlers()
  registerEngineHandlers()
  registerSyncHandlers()
  registerCafeHandlers()
  ipcMain.removeHandler('app:getStartTime')
  ipcMain.handle('app:getStartTime', () => appStartTime)
  createWindow()
  app.on('second-instance', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show()
      mainWindow.focus()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
