import { contextBridge, ipcRenderer } from 'electron'

// 리스너 중복 방지 (React Strict Mode 등으로 onLog/onStatusChange가 두 번 호출되면 로그가 두 번 찍힘)
let logListener: ((_e: Electron.IpcRendererEvent, line: string) => void) | null = null
let statusListener: ((_e: Electron.IpcRendererEvent, status: string) => void) | null = null
let extractedLinksListener: ((_e: Electron.IpcRendererEvent, item: { url: string; postTitle?: string; extractedAt: number; status?: string }) => void) | null = null
let extractedLinkUpdatedListener: ((_e: Electron.IpcRendererEvent, item: unknown) => void) | null = null

contextBridge.exposeInMainWorld('catchDeal', {
  login: (email: string, password: string) => ipcRenderer.invoke('auth:login', email, password),
  logout: () => ipcRenderer.invoke('auth:logout'),
  getSession: () => ipcRenderer.invoke('auth:getSession'),
  getHwid: () => ipcRenderer.invoke('auth:getHwid'),
  getCoupangCookiesSummary: () => ipcRenderer.invoke('auth:getCoupangCookiesSummary'),
  setCoupangCookies: (json: string) => ipcRenderer.invoke('auth:setCoupangCookies', json),
  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (config: unknown) => ipcRenderer.invoke('config:set', config),
  setPaymentPassword: (password: string) => ipcRenderer.invoke('config:setPaymentPassword', password),
  startEngine: () => ipcRenderer.invoke('engine:start'),
  stopEngine: () => ipcRenderer.invoke('engine:stop'),
  getEngineStatus: () => ipcRenderer.invoke('engine:getStatus'),
  getDailyStats: () => ipcRenderer.invoke('engine:getDailyStats'),
  getExtractedLinks: () => ipcRenderer.invoke('engine:getExtractedLinks') as Promise<import('@catchdeal/shared').ExtractedLinkItem[]>,
  onExtractedLinks: (cb: (item: import('@catchdeal/shared').ExtractedLinkItem) => void) => {
    if (extractedLinksListener) ipcRenderer.removeListener('engine:extractedLinks', extractedLinksListener)
    extractedLinksListener = (_e, item) => cb(item as import('@catchdeal/shared').ExtractedLinkItem)
    ipcRenderer.on('engine:extractedLinks', extractedLinksListener)
  },
  onExtractedLinkUpdated: (cb: (item: import('@catchdeal/shared').ExtractedLinkItem) => void) => {
    if (extractedLinkUpdatedListener) ipcRenderer.removeListener('engine:extractedLinkUpdated', extractedLinkUpdatedListener)
    extractedLinkUpdatedListener = (_e, item) => cb(item as import('@catchdeal/shared').ExtractedLinkItem)
    ipcRenderer.on('engine:extractedLinkUpdated', extractedLinkUpdatedListener)
  },
  onLog: (cb: (line: string) => void) => {
    if (logListener) ipcRenderer.removeListener('engine:log', logListener)
    logListener = (_e, line: string) => cb(line)
    ipcRenderer.on('engine:log', logListener)
  },
  onStatusChange: (cb: (status: string) => void) => {
    if (statusListener) ipcRenderer.removeListener('engine:status', statusListener)
    statusListener = (_e, status: string) => cb(status)
    ipcRenderer.on('engine:status', statusListener)
  },
  getTradeLogs: (limit?: number) => ipcRenderer.invoke('sync:getTradeLogs', limit),
  openOrderPage: (url: string) => ipcRenderer.invoke('sync:openOrderPage', url),
  openSalePage: (url: string) => ipcRenderer.invoke('sync:openSalePage', url),
  launchChromeWithDebug: () => ipcRenderer.invoke('sync:launchChromeWithDebug') as Promise<{ ok: boolean; error?: string }>,
  getAppStartTime: () => ipcRenderer.invoke('app:getStartTime') as Promise<number>,
  /** 네이버 카페 목록에서 키워드 포함 글 링크만 조회 */
  fetchCafeLinks: (cafeListUrl: string, keyword: string) =>
    ipcRenderer.invoke('cafe:fetchLinks', cafeListUrl, keyword) as Promise<{ ok: boolean; links: { title: string; url: string }[]; error?: string }>,
})
