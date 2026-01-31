import { useState, useEffect, useRef } from 'react'
import MainTab from './MainTab'
import QueryTab from './QueryTab'
import SettingsTab from './SettingsTab'
import CafeTab from './CafeTab'

const TASK_LABELS: Record<string, string> = {
  idle: '대기 중',
  scanning: '스캔 중',
  purchasing: '구매 중',
  error: '오류',
  stopped: '중지됨',
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':')
}

interface DashboardProps {
  onLogout: () => void
}

type TabId = 'main' | 'query' | 'cafe' | 'settings'

const isRunning = (s: string) => s === 'scanning' || s === 'purchasing'

export default function Dashboard({ onLogout }: DashboardProps) {
  const [tab, setTab] = useState<TabId>('main')
  const [scanRuntimeDisplay, setScanRuntimeDisplay] = useState('00:00:00')
  const [currentTask, setCurrentTask] = useState<string>('idle')
  const [logs, setLogs] = useState<string[]>([])
  const scanStartRef = useRef(0)
  const prevTaskRef = useRef(currentTask)

  useEffect(() => {
    window.catchDeal?.getEngineStatus().then((s) => setCurrentTask(s || 'idle'))
    const onLog = (line: string) => setLogs((prev) => [...prev.slice(-500), line])
    const onStatus = (s: string) => setCurrentTask(s)
    window.catchDeal?.onLog(onLog)
    window.catchDeal?.onStatusChange(onStatus)
  }, [])

  useEffect(() => {
    if (isRunning(currentTask)) {
      if (!isRunning(prevTaskRef.current)) scanStartRef.current = Date.now()
      prevTaskRef.current = currentTask
      const id = setInterval(() => {
        setScanRuntimeDisplay(formatUptime(Math.floor((Date.now() - scanStartRef.current) / 1000)))
      }, 1000)
      return () => clearInterval(id)
    }
    prevTaskRef.current = currentTask
  }, [currentTask])

  const taskLabel = TASK_LABELS[currentTask] ?? currentTask

  return (
    <div className="dashboard">
      <header className="header">
        <h1>CatchDeal</h1>
        <nav>
          <button className={tab === 'main' ? 'active' : ''} onClick={() => setTab('main')}>대시보드</button>
          <button className={tab === 'query' ? 'active' : ''} onClick={() => setTab('query')}>조회하기</button>
          <button className={tab === 'cafe' ? 'active' : ''} onClick={() => setTab('cafe')}>카페 링크</button>
          <button className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}>환경설정</button>
        </nav>
        <div className="header-status">
          <span className="runtime" title="스캔 실행 시간 (Stop 시 멈춤)">스캔: {scanRuntimeDisplay}</span>
          <span className="current-task" title="현재 작업">현재: {taskLabel}</span>
        </div>
        <button className="logout" onClick={onLogout}>로그아웃</button>
      </header>
      <main className="content">
        {tab === 'main' && (
          <div className="content-inner">
            <MainTab logs={logs} status={currentTask} onLogError={(msg) => setLogs((prev) => [...prev, msg])} />
          </div>
        )}
        {tab === 'query' && <div className="content-inner"><QueryTab /></div>}
        {tab === 'cafe' && <div className="content-inner"><CafeTab /></div>}
        {tab === 'settings' && <div className="content-inner"><SettingsTab /></div>}
      </main>
      <style>{`
        .dashboard { min-height: 100vh; display: flex; flex-direction: column; }
        .header { display: flex; align-items: center; gap: 1rem; padding: 0.75rem 1.5rem; border-bottom: 1px solid var(--border); background: var(--bg-card); }
        .header h1 { margin: 0; font-size: 1.25rem; }
        .header nav { display: flex; gap: 0.25rem; }
        .header nav button { padding: 0.5rem 1rem; background: transparent; color: var(--text-muted); border: none; border-radius: 6px; }
        .header nav button:hover { color: #e7e9ea; }
        .header nav button.active { background: var(--accent); color: #fff; }
        .header-status { display: flex; align-items: center; gap: 1rem; margin-left: 1rem; font-size: 0.8125rem; color: var(--text-muted); }
        .header-status .runtime { font-family: 'Consolas', monospace; }
        .header-status .current-task { padding: 0.25rem 0.5rem; background: rgba(0,0,0,0.3); border-radius: 4px; color: var(--accent); }
        .logout { margin-left: auto; padding: 0.5rem 1rem; background: transparent; color: var(--text-muted); border: 1px solid var(--border); border-radius: 6px; }
        .logout:hover { color: var(--danger); border-color: var(--danger); }
        .content { flex: 1; min-height: 0; padding: 1.5rem; overflow: auto; display: flex; flex-direction: column; }
        .content-inner { flex: 1; min-height: 0; overflow: auto; display: flex; flex-direction: column; }
      `}</style>
    </div>
  )
}
