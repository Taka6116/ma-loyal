import type { Metadata } from 'next'
import '@/styles/globals.css'
import LayoutWithSidebar from './LayoutWithSidebar'

export const metadata: Metadata = {
  title: 'MAS — M&A LOYAL Article System',
  description: 'M&A LOYAL 記事制作ツール',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ja">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=Noto+Sans+JP:wght@300;400;500;700;900&family=Noto+Serif+JP:wght@400;700&family=DM+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#FAF8F5]">
        <LayoutWithSidebar>{children}</LayoutWithSidebar>
      </body>
    </html>
  )
}
