import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'CatchDeal 관리자',
  description: '회원 라이선스 관리 및 통계',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  )
}
