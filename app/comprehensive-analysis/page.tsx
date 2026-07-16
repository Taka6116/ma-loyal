'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRight, ClipboardCheck, FileText, RefreshCw, Target } from 'lucide-react'
import type { AhrefsDataset } from '@/lib/ahrefsCsvParser'
import { getKeywordData } from '@/lib/analysisDashboard'

interface AhrefsResponse {
  datasets: AhrefsDataset[]
  error?: string
}

export default function ComprehensiveAnalysisPage() {
  const [datasets, setDatasets] = useState<AhrefsDataset[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/ahrefs', { cache: 'no-store' })
      const data = (await response.json()) as AhrefsResponse
      if (!response.ok) throw new Error(data.error ?? '分析データを取得できませんでした')
      setDatasets(data.datasets ?? [])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '分析データを取得できませんでした')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadData() }, [loadData])

  const analysis = useMemo(() => getKeywordData(datasets), [datasets])
  const topKeywords = analysis.priorityKeywords.slice(0, 8)
  const organicKeywordSet = useMemo(() => new Set(analysis.organicKeywords.map(keyword => keyword.keyword.trim().toLowerCase())), [analysis.organicKeywords])
  const gaps = useMemo(
    () => analysis.priorityKeywords.filter(keyword => !organicKeywordSet.has(keyword.keyword.trim().toLowerCase())).slice(0, 6),
    [analysis.priorityKeywords, organicKeywordSet]
  )

  return (
    <div className="w-full max-w-5xl py-8">
      <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-bold tracking-[0.16em] text-[#97876A]">M&amp;A LOYAL STRATEGY OVERVIEW</p>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-[#222222]">
            <ClipboardCheck size={25} className="text-[#8B1A2A]" />
            総合分析
          </h1>
          <p className="mt-1 text-sm text-[#64748B]">市場KWと競合KWをまとめ、次に着手するコンテンツ施策を整理します。</p>
        </div>
        <button type="button" onClick={() => void loadData()} disabled={loading} className="inline-flex items-center gap-1.5 rounded-lg bg-[#8B1A2A] px-3.5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />更新
        </button>
      </div>

      {error && <p className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Metric label="市場の優先KW" value={analysis.priorityKeywords.length} suffix="件" />
        <Metric label="競合の獲得KW" value={analysis.organicKeywords.length} suffix="件" />
        <Metric label="優先ギャップ候補" value={gaps.length} suffix="件" accent />
      </div>

      {datasets.length === 0 && !loading ? (
        <div className="rounded-xl border border-dashed border-[#C4A0A6] bg-white p-10 text-center">
          <p className="font-bold text-[#222222]">分析を始めるにはCSVのインポートが必要です</p>
          <p className="mt-2 text-sm text-[#64748B]">市場KWと競合KWのCSVを登録すると、M&amp;A LOYAL向けの施策一覧を生成します。</p>
          <Link href="/ahrefs" className="mt-5 inline-flex rounded-lg bg-[#8B1A2A] px-4 py-2 text-sm font-semibold text-white hover:opacity-90">CSVをインポートする</Link>
        </div>
      ) : (
        <div className="space-y-6">
          <Recommendation title="優先して記事化するキーワード" icon={<FileText size={19} />} description="検索ボリューム、難易度、需要トレンドをもとに優先度が高い順に表示します。">
            <KeywordList keywords={topKeywords} showCategory />
          </Recommendation>

          <Recommendation title="競合との差分から狙うテーマ" icon={<Target size={19} />} description="市場KWのうち、登録済み競合KWに含まれない優先候補です。競合調査を深める前の着手候補として活用できます。">
            {gaps.length > 0 ? <KeywordList keywords={gaps} /> : <p className="text-sm text-[#64748B]">競合KWデータを追加すると、差分候補を表示します。</p>}
          </Recommendation>

          <Link href="/content-analysis" className="flex items-center justify-between rounded-xl border border-[#E8D5D8] bg-[#FDF5F6] px-5 py-4 transition-colors hover:border-[#8B1A2A]">
            <span><strong className="text-[#222222]">コンテンツ分析でテーマ分布を確認</strong><span className="mt-1 block text-xs text-[#64748B]">カテゴリごとのキーワード数をもとに、コンテンツの網羅性を確認します。</span></span>
            <ArrowRight size={20} className="text-[#8B1A2A]" />
          </Link>
        </div>
      )}
    </div>
  )
}

function Recommendation({ title, icon, description, children }: { title: string; icon: React.ReactNode; description: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[#E8D5D8] bg-white p-5">
      <div className="mb-4 flex items-start gap-2">
        <span className="mt-0.5 text-[#8B1A2A]">{icon}</span>
        <div>
          <h2 className="font-bold text-[#222222]">{title}</h2>
          <p className="mt-1 text-xs leading-relaxed text-[#64748B]">{description}</p>
        </div>
      </div>
      {children}
    </section>
  )
}

function KeywordList({ keywords, showCategory = false }: { keywords: ReturnType<typeof getKeywordData>['priorityKeywords']; showCategory?: boolean }) {
  return (
    <div className="space-y-2">
      {keywords.map(keyword => (
        <div key={keyword.keyword} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#FAF8F5] px-3 py-2.5">
          <div>
            <span className="font-bold text-[#222222]">{keyword.keyword}</span>
            {showCategory && <span className="ml-2 rounded bg-white px-1.5 py-0.5 text-[10px] text-[#64748B]">{keyword.detectedCategory}</span>}
          </div>
          <span className="text-xs text-[#64748B]">Vol {keyword.volume.toLocaleString()} / KD {keyword.kd} / 優先度 {'★'.repeat(keyword.priority)}</span>
        </div>
      ))}
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
