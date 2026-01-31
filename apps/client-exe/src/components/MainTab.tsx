import { useState, useEffect, useRef } from 'react'

export default function MainTab() {
  const [status, setStatus] = useState<string>('idle')
  const [stats, setStats] = useState({ scanCount: 0, purchaseCount: 0, date: '' })
  const [logs, setLogs] = useState<string[]>([])
  const logEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.catchDeal?.getEngineStatus().then(setStatus)
    window.catchDeal?.getDailyStats().then(setStats)
  }, [])

  useEffect(() => {
    const onLog = (line: string) => setLogs((prev) => [...prev.slice(-500), line])
    const onStatus = (s: string) => setStatus(s)
    window.catchDeal?.onLog(onLog)
    window.catchDeal?.onStatusChange(onStatus)
  }, [])

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const refreshStats = () => {
    window.catchDeal?.getDailyStats().then(setStats)
    window.catchDeal?.getEngineStatus().then(setStatus)
  }

  const handleStart = async () => {
    const res = await window.catchDeal?.startEngine()
    if (res && !res.ok) setLogs((prev) => [...prev, `오류: ${res.error}`])
    refreshStats()
  }

  const handleStop = async () => {
    await window.catchDeal?.stopEngine()
    refreshStats()
  }

  const running = status === 'scanning' || status === 'purchasing'

  return (
    <div className="main-tab">
      <div className="controls">
        <div className="stats">
          <span>금일 스캔: <strong>{stats.scanCount}</strong></span>
          <span>구매 성공: <strong>{stats.purchaseCount}</strong></span>
        </div>
        <div className="buttons">
          <button className="start" onClick={handleStart} disabled={running}>Start</button>
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
        .main-tab { display: flex; flex-direction: column; gap: 1rem; height: 100%; }
        .controls { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; }
        .stats { display: flex; gap: 1.5rem; color: var(--text-muted); }
        .stats strong { color: var(--accent); }
        .buttons { display: flex; gap: 0.5rem; }
        .buttons .start { padding: 0.5rem 1.5rem; background: var(--success); color: #fff; border: none; border-radius: 8px; font-weight: 600; }
        .buttons .start:disabled { opacity: 0.5; cursor: not-allowed; }
        .buttons .stop { padding: 0.5rem 1.5rem; background: var(--danger); color: #fff; border: none; border-radius: 8px; font-weight: 600; }
        .buttons .stop:disabled { opacity: 0.5; cursor: not-allowed; }
        .log-box { flex: 1; min-height: 320px; background: #0f1419; border: 1px solid var(--border); border-radius: 8px; overflow: auto; }
        .log-content { margin: 0; padding: 1rem; font-family: 'Consolas', monospace; font-size: 0.8125rem; line-height: 1.5; white-space: pre-wrap; word-break: break-all; }
      `}</style>
    </div>
  )
}
