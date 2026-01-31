import { useState, useEffect } from 'react'
import type { TradeLog } from '@catchdeal/shared'

export default function QueryTab() {
  const [rows, setRows] = useState<TradeLog[]>([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    window.catchDeal?.getTradeLogs(100).then((data) => {
      setRows((data as TradeLog[]) || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  return (
    <div className="query-tab">
      <div className="toolbar">
        <button onClick={load} disabled={loading}>{loading ? '로딩 중...' : '새로고침'}</button>
      </div>
      <div className="table-wrap">
        <table className="data-grid">
          <thead>
            <tr>
              <th>상품명</th>
              <th>구매가</th>
              <th>판매예정가</th>
              <th>상태</th>
              <th>생성일시</th>
              <th>액션</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="name">{r.product_name}</td>
                <td>{r.buy_price?.toLocaleString()}원</td>
                <td>{r.sell_price?.toLocaleString()}원</td>
                <td>{r.status}</td>
                <td>{r.created_at ? new Date(r.created_at).toLocaleString('ko-KR') : '-'}</td>
                <td>
                  <button className="link-btn" onClick={() => window.catchDeal?.openOrderPage(r.coupang_link)}>주문내역 확인</button>
                  <button className="link-btn" onClick={() => window.catchDeal?.openSalePage(r.coupang_link)}>판매글 확인</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && !rows.length && <p className="empty">거래 내역이 없습니다.</p>}
      </div>
      <style>{`
        .query-tab { display: flex; flex-direction: column; gap: 1rem; }
        .toolbar button { padding: 0.5rem 1rem; background: var(--accent); color: #fff; border: none; border-radius: 6px; }
        .toolbar button:disabled { opacity: 0.6; }
        .table-wrap { overflow: auto; border: 1px solid var(--border); border-radius: 8px; }
        .data-grid { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
        .data-grid th, .data-grid td { padding: 0.75rem 1rem; text-align: left; border-bottom: 1px solid var(--border); }
        .data-grid th { background: var(--bg-card); color: var(--text-muted); font-weight: 600; }
        .data-grid .name { max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .data-grid .link-btn { margin-right: 0.5rem; padding: 0.25rem 0.5rem; background: transparent; color: var(--accent); border: none; font-size: 0.8125rem; }
        .data-grid .link-btn:hover { text-decoration: underline; }
        .empty { padding: 2rem; text-align: center; color: var(--text-muted); }
      `}</style>
    </div>
  )
}
