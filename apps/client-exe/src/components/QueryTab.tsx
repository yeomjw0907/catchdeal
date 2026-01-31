import { useState, useEffect } from 'react'
import type { TradeLog, ExtractedLinkItem } from '@catchdeal/shared'

export default function QueryTab() {
  const [rows, setRows] = useState<TradeLog[]>([])
  const [loading, setLoading] = useState(true)
  const [extractedLinks, setExtractedLinks] = useState<ExtractedLinkItem[]>([])

  const load = () => {
    setLoading(true)
    window.catchDeal?.getTradeLogs(100).then((data) => {
      setRows((data as TradeLog[]) || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  const loadExtractedLinks = () => {
    window.catchDeal?.getExtractedLinks().then((list) => setExtractedLinks((list as ExtractedLinkItem[]) ?? []))
  }

  useEffect(() => { load() }, [])
  useEffect(() => {
    loadExtractedLinks()
    window.catchDeal?.onExtractedLinks((item) => setExtractedLinks((prev) => [...prev, item as ExtractedLinkItem]))
    window.catchDeal?.onExtractedLinkUpdated((updated) => {
      setExtractedLinks((prev) => {
        const u = updated as ExtractedLinkItem
        const i = prev.findIndex((x) => x.url === u.url && x.extractedAt === u.extractedAt)
        if (i < 0) return prev
        const next = [...prev]
        next[i] = u
        return next
      })
    })
  }, [])

  return (
    <div className="query-tab">
      <section className="query-section">
        <h2 className="section-title">추출된 링크 (카페 스캔 + 해부)</h2>
        <p className="section-desc">카페 스캔 시 추출된 쿠팡 링크를 실시간 해부(상품명·구매가 파싱)합니다. 실패 시 후순위로 미루고 최대 5회 재시도 후 실패 처리.</p>
        <div className="toolbar">
          <button onClick={loadExtractedLinks}>새로고침</button>
        </div>
        <div className="table-wrap">
          <table className="data-grid">
            <thead>
              <tr>
                <th>상태</th>
                <th>출처 글</th>
                <th>상품명</th>
                <th>구매가</th>
                <th>링크</th>
                <th>추출 시각</th>
                <th>액션</th>
              </tr>
            </thead>
            <tbody>
              {[...extractedLinks].reverse().map((item, i) => (
                <tr key={`${item.url}-${item.extractedAt}-${i}`} className={item.status === 'failed' ? 'row-failed' : ''}>
                  <td>
                    <span className={`status-badge status-${item.status}`}>
                      {item.status === 'pending' ? '해부 중' : item.status === 'success' ? '성공' : '실패'}
                    </span>
                  </td>
                  <td className="name" title={item.postTitle}>{item.postTitle ? (item.postTitle.length > 30 ? item.postTitle.slice(0, 30) + '…' : item.postTitle) : '-'}</td>
                  <td className="name" title={item.productName}>
                    {item.status === 'success' && item.productName ? (item.productName.length > 35 ? item.productName.slice(0, 35) + '…' : item.productName) : item.status === 'failed' && item.errorMessage ? `실패: ${item.errorMessage.slice(0, 25)}…` : '-'}
                  </td>
                  <td>{item.status === 'success' && item.price != null ? `${item.price.toLocaleString()}원` : '-'}</td>
                  <td className="url-cell" title={item.url}>{item.url.length > 40 ? item.url.slice(0, 40) + '…' : item.url}</td>
                  <td>{new Date(item.extractedAt).toLocaleString('ko-KR')}</td>
                  <td>
                    <button className="link-btn" onClick={() => window.open(item.url, '_blank')}>열기</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!extractedLinks.length && <p className="empty">추출된 링크가 없습니다. 대시보드에서 Start 후 카페 스캔을 돌리면 여기에 쌓입니다.</p>}
        </div>
      </section>

      <section className="query-section">
        <h2 className="section-title">거래 내역</h2>
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
      </section>
      <style>{`
        .query-tab { display: flex; flex-direction: column; gap: 2rem; }
        .query-section { display: flex; flex-direction: column; gap: 0.75rem; }
        .section-title { margin: 0; font-size: 1rem; }
        .section-desc { margin: 0; font-size: 0.8125rem; color: var(--text-muted); }
        .toolbar button { padding: 0.5rem 1rem; background: var(--accent); color: #fff; border: none; border-radius: 6px; }
        .toolbar button:disabled { opacity: 0.6; }
        .table-wrap { overflow: auto; border: 1px solid var(--border); border-radius: 8px; }
        .data-grid { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
        .data-grid th, .data-grid td { padding: 0.75rem 1rem; text-align: left; border-bottom: 1px solid var(--border); }
        .data-grid th { background: var(--bg-card); color: var(--text-muted); font-weight: 600; }
        .data-grid .name { max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .data-grid .url-cell { max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .data-grid .link-btn { margin-right: 0.5rem; padding: 0.25rem 0.5rem; background: transparent; color: var(--accent); border: none; font-size: 0.8125rem; }
        .data-grid .link-btn:hover { text-decoration: underline; }
        .status-badge { padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem; }
        .status-pending { background: rgba(255,193,7,0.25); color: #ffc107; }
        .status-success { background: rgba(40,167,69,0.25); color: var(--success); }
        .status-failed { background: rgba(220,53,69,0.25); color: var(--danger); }
        .row-failed { background: rgba(220,53,69,0.08); }
        .empty { padding: 2rem; text-align: center; color: var(--text-muted); }
      `}</style>
    </div>
  )
}
