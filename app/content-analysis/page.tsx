'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { BarChart3, FileText, RefreshCw, Search, TrendingUp } from 'lucide-react'
import type { AhrefsDataset } from '@/lib/ahrefsCsvParser'
import { getKeywordData } from '@/lib/analysisDashboard'

interface AhrefsResponse {
  datasets: AhrefsDataset[]
  error?: string
}

export default function ContentAnalysisPage() {
  const [datasets, setDatasets] = useState<AhrefsDataset[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/ahrefs', { cache: 'no-store' })
      const data = (await response.json()) as AhrefsResponse
      if (!response.ok) throw new Error(data.error ?? 'キーワードデータを取得できませんでした')
      setDatasets(data.datasets ?? [])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'キーワードデータを取得できませんでした')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadData() }, [loadData])

  const analysis = useMemo(() => getKeywordData(datasets), [datasets])
  const topCategories = analysis.categories.slice(0, 6)

  return (
    <div className="w-full max-w-5xl py-8">
      <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-bold tracking-[0.16em] text-[#97876A]">M&amp;A LOYAL CONTENT INTELLIGENCE</p>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-[#222222]">
            <BarChart3 size={25} className="text-[#8B1A2A]" />
            コンテンツ分析
          </h1>
          <p className="mt-1 text-sm text-[#64748B]">AhrefsのCSVをもとに、優先すべきコンテンツテーマを確認します。</p>
        </div>
        <button
          type="button"
          onClick={() => void loadData()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#8B1A2A] px-3.5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          更新
        </button>
      </div>

      {error && <p className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Metric label="市場KW" value={analysis.marketKeywords.length} suffix="件" />
        <Metric label="優先コンテンツ候補" value={analysis.priorityKeywords.length} suffix="件" accent />
        <Metric label="分析カテゴリ" value={analysis.categories.length} suffix="分類" />
      </div>

      {datasets.length === 0 && !loading ? (
        <EmptyState />
      ) : (
        <>
          <section className="mb-6 rounded-xl border border-[#E8D5D8] bg-white p-5">
            <div className="mb-4 flex items-center gap-2">
              <TrendingUp size={19} className="text-[#8B1A2A]" />
              <div>
                <h2 className="font-bold text-[#222222]">注力テーマ</h2>
                <p className="text-xs text-[#64748B]">優先度が高いキーワードが多いテーマです。</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {topCategories.map(category => (
                <div key={category.category} className="rounded-lg border border-[#E8D5D8] bg-[#FDF5F6] p-4">
                  <p className="text-sm font-bold text-[#222222]">{category.category}</p>
                  <p className="mt-1 text-2xl font-bold text-[#8B1A2A]">{category.count}<span className="ml-1 text-xs text-[#64748B]">KW</span></p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-[#E8D5D8] bg-white p-5">
            <h2 className="mb-4 font-bold text-[#222222]">次のアクション</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <ActionLink href="/ahrefs" icon={<Search size={19} />} title="KWを精査する" description="難易度・検索ボリューム・トレンドから記事テーマを選定します。" />
              <ActionLink href="/editor?new=1" icon={<FileText size={19} />} title="記事を作成する" description="選定したキーワードをもとに、記事作成を開始します。" />
            </div>
          </section>
        </>
      )}
    </div>
  )
}

function Metric({ label, value, suffix, accent = false }: { label: string; value: number; suffix: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${accent ? 'border-[#C4A0A6] bg-[#FDF5F6]' : 'border-[#E8D5D8] bg-white'}`}>
      <p className="text-xs font-semibold text-[#64748B]">{label}</p>
      <p className="mt-1 text-3xl font-bold text-[#222222]">{value.toLocaleString()}<span className="ml-1 text-xs text-[#64748B]">{suffix}</span></p>
    </div>
  )
}

function ActionLink({ href, icon, title, description }: { href: string; icon: React.ReactNode; title: string; description: string }) {
  return (
    <Link href={href} className="rounded-lg border border-[#E8D5D8] p-4 transition-colors hover:border-[#8B1A2A] hover:bg-[#FDF5F6]">
      <div className="mb-2 text-[#8B1A2A]">{icon}</div>
      <p className="text-sm font-bold text-[#222222]">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-[#64748B]">{description}</p>
    </Link>
  )
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-[#C4A0A6] bg-white p-10 text-center">
      <p className="font-bold text-[#222222]">キーワードデータを読み込んでください</p>
      <p className="mt-2 text-sm text-[#64748B]">AhrefsからエクスポートしたCSVをインポートすると、M&amp;A LOYAL向けのコンテンツ分析を開始できます。</p>
      <Link href="/ahrefs" className="mt-5 inline-flex rounded-lg bg-[#8B1A2A] px-4 py-2 text-sm font-semibold text-white hover:opacity-90">CSVをインポートする</Link>
    </div>
  )
}
