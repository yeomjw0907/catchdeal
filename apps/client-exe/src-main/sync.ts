import { ipcMain, shell } from 'electron'
import { fetchTradeLogs } from './supabase'

export function registerSyncHandlers() {
  ipcMain.handle('sync:getTradeLogs', async (_e, limit?: number) => {
    return fetchTradeLogs(limit ?? 100)
  })

  ipcMain.handle('sync:openOrderPage', (_e, url: string) => {
    if (url && url.startsWith('http')) shell.openExternal(url)
  })

  ipcMain.handle('sync:openSalePage', (_e, url: string) => {
    if (url && url.startsWith('http')) shell.openExternal(url)
  })
}
