'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import MainContentWidth from './MainContentWidth'

export default function LayoutWithSidebar({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const isLogin = pathname === '/login'

  if (isLogin) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-[#FAF8F5] px-4">
        {children}
      </div>
    )
  }

  return (
    <div className="flex min-h-screen">
      <aside
        className="
          fixed top-0 left-0 h-screen w-[220px] flex-shrink-0 z-40
          text-white border-r flex flex-col
        "
        style={{ backgroundColor: '#222222', borderColor: '#444444' }}
      >
        <div className="px-4 py-4 border-b flex items-center justify-center" style={{ borderColor: '#444444' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/ma-loyal-logo.png"
            alt="M&A LOYAL ADVISORY"
            className="w-[160px] h-auto"
            style={{ filter: 'brightness(0) invert(1) opacity(0.9)' }}
          />
        </div>

        <nav className="flex-1 px-3 py-4 text-sm space-y-6">
          <div>
            <div className="space-y-1">
              {[
                { href: '/editor', label: '記事を作成' },
                { href: '/articles', label: '保存済み記事一覧' },
                { href: '/published', label: '過去投稿済み記事一覧' },
                { href: '/schedule', label: '投稿スケジュール' },
                { href: '/prompts', label: 'プロンプト' },
                { href: '/keywords', label: 'キーワード' },
                { href: '/ahrefs', label: 'KW分析' },
                { href: '/notice', label: '注意書き' },
              ].map(({ href, label }) => {
                const isActive = pathname === href || pathname.startsWith(href + '/')
                return (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center px-3 py-2.5 rounded-lg text-[16px] font-semibold transition-all"
                    style={{
                      color: isActive ? '#FFFFFF' : 'rgba(255,255,255,0.75)',
                      background: isActive ? '#97876A' : 'transparent',
                      boxShadow: isActive ? 'inset 3px 0 0 #F5F0E8' : 'none',
                    }}
                  >
                    {label}
                  </Link>
                )
              })}
            </div>
          </div>
        </nav>

        <div className="px-4 py-3 border-t" style={{ borderColor: '#444444' }}>
          <div className="text-center">
            <div className="text-[10px] font-bold text-white opacity-50 tracking-widest">MAS</div>
            <div className="text-[9px] text-white opacity-40 tracking-wide mt-0.5">M&amp;A LOYAL Article System</div>
          </div>
        </div>
      </aside>

      <div className="ml-[220px] flex-1 flex flex-col min-h-screen bg-[#FAF8F5]">
        <main className="flex-1 flex items-center justify-center px-6 py-8">
          <MainContentWidth>{children}</MainContentWidth>
        </main>
      </div>
    </div>
  )
}
