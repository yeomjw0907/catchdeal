import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('catchDeal', {
  login: (email: string, password: string) => ipcRenderer.invoke('auth:login', email, password),
  logout: () => ipcRenderer.invoke('auth:logout'),
  getSession: () => ipcRenderer.invoke('auth:getSession'),
  getHwid: () => ipcRenderer.invoke('auth:getHwid'),
  openCoupangLogin: () => ipcRenderer.invoke('auth:openCoupangLogin'),
  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (config: unknown) => ipcRenderer.invoke('config:set', config),
  setPaymentPassword: (password: string) => ipcRenderer.invoke('config:setPaymentPassword', password),
  startEngine: () => ipcRenderer.invoke('engine:start'),
  stopEngine: () => ipcRenderer.invoke('engine:stop'),
  getEngineStatus: () => ipcRenderer.invoke('engine:getStatus'),
  getDailyStats: () => ipcRenderer.invoke('engine:getDailyStats'),
  onLog: (cb: (line: string) => void) => {
    ipcRenderer.on('engine:log', (_e, line: string) => cb(line))
  },
  onStatusChange: (cb: (status: string) => void) => {
    ipcRenderer.on('engine:status', (_e, status: string) => cb(status))
  },
  getTradeLogs: (limit?: number) => ipcRenderer.invoke('sync:getTradeLogs', limit),
  openOrderPage: (url: string) => ipcRenderer.invoke('sync:openOrderPage', url),
  openSalePage: (url: string) => ipcRenderer.invoke('sync:openSalePage', url),
})
