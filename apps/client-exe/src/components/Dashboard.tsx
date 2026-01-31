import { useState } from 'react'
import MainTab from './MainTab'
import QueryTab from './QueryTab'
import SettingsTab from './SettingsTab'

interface DashboardProps {
  onLogout: () => void
}

type TabId = 'main' | 'query' | 'settings'

export default function Dashboard({ onLogout }: DashboardProps) {
  const [tab, setTab] = useState<TabId>('main')

  return (
    <div className="dashboard">
      <header className="header">
        <h1>CatchDeal</h1>
        <nav>
          <button className={tab === 'main' ? 'active' : ''} onClick={() => setTab('main')}>대시보드</button>
          <button className={tab === 'query' ? 'active' : ''} onClick={() => setTab('query')}>조회하기</button>
          <button className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}>환경설정</button>
        </nav>
        <button className="logout" onClick={onLogout}>로그아웃</button>
      </header>
      <main className="content">
        {tab === 'main' && <MainTab />}
        {tab === 'query' && <QueryTab />}
        {tab === 'settings' && <SettingsTab />}
      </main>
      <style>{`
        .dashboard { min-height: 100vh; display: flex; flex-direction: column; }
        .header { display: flex; align-items: center; gap: 1rem; padding: 0.75rem 1.5rem; border-bottom: 1px solid var(--border); background: var(--bg-card); }
        .header h1 { margin: 0; font-size: 1.25rem; }
        .header nav { display: flex; gap: 0.25rem; }
        .header nav button { padding: 0.5rem 1rem; background: transparent; color: var(--text-muted); border: none; border-radius: 6px; }
        .header nav button:hover { color: #e7e9ea; }
        .header nav button.active { background: var(--accent); color: #fff; }
        .logout { margin-left: auto; padding: 0.5rem 1rem; background: transparent; color: var(--text-muted); border: 1px solid var(--border); border-radius: 6px; }
        .logout:hover { color: var(--danger); border-color: var(--danger); }
        .content { flex: 1; padding: 1.5rem; overflow: auto; }
      `}</style>
    </div>
  )
}
