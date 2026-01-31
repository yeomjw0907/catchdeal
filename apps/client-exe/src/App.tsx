import { useState, useEffect } from 'react'
import Login from './components/Login'
import Dashboard from './components/Dashboard'

declare global {
  interface Window {
    catchDeal: {
      login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>
      logout: () => Promise<{ ok: boolean }>
      getSession: () => Promise<{ session: unknown; user: unknown } | null>
      getConfig: () => Promise<unknown>
      setConfig: (c: unknown) => Promise<unknown>
      setPaymentPassword: (p: string) => Promise<boolean>
      startEngine: () => Promise<{ ok: boolean; error?: string }>
      stopEngine: () => Promise<{ ok: boolean }>
      getEngineStatus: () => Promise<string>
      getDailyStats: () => Promise<{ scanCount: number; purchaseCount: number; date: string }>
      getExtractedLinks: () => Promise<import('@catchdeal/shared').ExtractedLinkItem[]>
      onExtractedLinks: (cb: (item: import('@catchdeal/shared').ExtractedLinkItem) => void) => void
      onExtractedLinkUpdated: (cb: (item: import('@catchdeal/shared').ExtractedLinkItem) => void) => void
      onLog: (cb: (line: string) => void) => void
      onStatusChange: (cb: (status: string) => void) => void
      getTradeLogs: (limit?: number) => Promise<unknown[]>
      openOrderPage: (url: string) => void
      openSalePage: (url: string) => void
      launchChromeWithDebug: () => Promise<{ ok: boolean; error?: string }>
      getAppStartTime: () => Promise<number>
      fetchCafeLinks: (cafeListUrl: string, keyword: string) => Promise<{ ok: boolean; links: { title: string; url: string }[]; error?: string }>
      getHwid: () => Promise<string>
      getCoupangCookiesSummary: () => Promise<{ count: number; names: string[] }>
      setCoupangCookies: (json: string) => Promise<{ ok: boolean; error?: string }>
    }
  }
}

export default function App() {
  const [session, setSession] = useState<unknown>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.catchDeal?.getSession().then((s) => {
      setSession(s?.session ?? null)
      setLoading(false)
    })
  }, [])

  const handleLogin = () => setSession('logged-in')
  const handleLogout = async () => {
    await window.catchDeal?.logout()
    setSession(null)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        로딩 중...
      </div>
    )
  }

  if (!session) {
    return <Login onSuccess={handleLogin} />
  }

  return <Dashboard onLogout={handleLogout} />
}
