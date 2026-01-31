import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'CatchDeal 쇼핑몰',
  description: '리셀 플랫폼 쇼핑몰',
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
