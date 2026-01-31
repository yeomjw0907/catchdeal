import { useState, useEffect, useRef } from 'react'

interface MainTabProps {
  logs: string[]
  status: string
  onLogError: (msg: string) => void
}

export default function MainTab({ logs, status, onLogError }: MainTabProps) {
  const [stats, setStats] = useState({ scanCount: 0, purchaseCount: 0, date: '' })
  const [isStarting, setIsStarting] = useState(false)
  const logEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.catchDeal?.getDailyStats().then(setStats)
  }, [])

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const refreshStats = () => {
    window.catchDeal?.getDailyStats().then(setStats)
  }

  const handleStart = async () => {
    if (isStarting || status === 'scanning' || status === 'purchasing') return
    setIsStarting(true)
    try {
      const res = await window.catchDeal?.startEngine()
      if (res && !res.ok) onLogError(`오류: ${res.error}`)
      refreshStats()
    } finally {
      setIsStarting(false)
    }
  }

  const handleStop = async () => {
    await window.catchDeal?.stopEngine()
    refreshStats()
  }

  const running = status === 'scanning' || status === 'purchasing'
  const startDisabled = running || isStarting

  return (
    <div className="main-tab">
      <p className="cdp-hint">카페를 실시간으로 확인합니다. 환경설정에서 <strong>카페 소스</strong>(목록 URL + 키워드)를 추가한 뒤, Start 전에 <strong>Chrome 디버깅 모드로 실행</strong>해 주세요.</p>
      <div className="controls">
        <div className="stats">
          <span>금일 스캔: <strong>{stats.scanCount}</strong></span>
          <span>구매 성공: <strong>{stats.purchaseCount}</strong></span>
        </div>
        <div className="buttons">
          <button className="start" onClick={handleStart} disabled={startDisabled}>
            {isStarting ? '시작 중...' : 'Start'}
          </button>
          <button className="stop" onClick={handleStop} disabled={!running}>Stop</button>
        </div>
      </div>
      <div className="log-box">
        <pre className="log-content">
          {logs.length ? logs.map((l, i) => <div key={i}>{l}</div>) : '대기 중... Start 버튼으로 스캔을 시작하세요.'}
        </pre>
        <div ref={logEndRef} />
      </div>
      <style>{`
        .main-tab { display: flex; flex-direction: column; gap: 1rem; height: 100%; min-height: 0; overflow: hidden; }
        .main-tab .cdp-hint { margin: 0 0 0.25rem; font-size: 0.8125rem; color: var(--text-muted); }
        .main-tab .cdp-hint strong { color: var(--accent); }
        .controls { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; }
        .stats { display: flex; gap: 1.5rem; color: var(--text-muted); }
        .stats strong { color: var(--accent); }
        .buttons { display: flex; gap: 0.5rem; }
        .buttons .start { padding: 0.5rem 1.5rem; background: var(--success); color: #fff; border: none; border-radius: 8px; font-weight: 600; }
        .buttons .start:disabled { opacity: 0.5; cursor: not-allowed; }
        .buttons .stop { padding: 0.5rem 1.5rem; background: var(--danger); color: #fff; border: none; border-radius: 8px; font-weight: 600; }
        .buttons .stop:disabled { opacity: 0.5; cursor: not-allowed; }
        .log-box { flex: 1; min-height: 0; background: #0f1419; border: 1px solid var(--border); border-radius: 8px; overflow: auto; }
        .log-content { margin: 0; padding: 1rem; font-family: 'Consolas', monospace; font-size: 0.8125rem; line-height: 1.5; white-space: pre-wrap; word-break: break-all; }
      `}</style>
    </div>
  )
}
