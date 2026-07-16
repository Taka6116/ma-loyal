'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Building2, ExternalLink, RefreshCw, Target, TrendingUp } from 'lucide-react'
import type { AhrefsDataset } from '@/lib/ahrefsCsvParser'
import { getKeywordData, summarizeCompetitors } from '@/lib/analysisDashboard'

interface AhrefsResponse {
  datasets: AhrefsDataset[]
  error?: string
}

export default function CompetitorAnalysisPage() {
  const [datasets, setDatasets] = useState<AhrefsDataset[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/ahrefs', { cache: 'no-store' })
      const data = (await response.json()) as AhrefsResponse
      if (!response.ok) throw new Error(data.error ?? '競合キーワードを取得できませんでした')
      setDatasets(data.datasets ?? [])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '競合キーワードを取得できませんでした')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadData() }, [loadData])

  const analysis = useMemo(() => getKeywordData(datasets), [datasets])
  const competitors = useMemo(() => summarizeCompetitors(analysis.organicKeywords), [analysis.organicKeywords])

  return (
    <div className="w-full max-w-5xl py-8">
      <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-bold tracking-[0.16em] text-[#97876A]">M&amp;A LOYAL MARKET INTELLIGENCE</p>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-[#222222]">
            <Building2 size={25} className="text-[#8B1A2A]" />
            競合分析
          </h1>
          <p className="mt-1 text-sm text-[#64748B]">競合サイトのOrganic Keywords CSVから、獲得テーマと上位キーワードを把握します。</p>
        </div>
        <button type="button" onClick={() => void loadData()} disabled={loading} className="inline-flex items-center gap-1.5 rounded-lg bg-[#8B1A2A] px-3.5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />更新
        </button>
      </div>

      {error && <p className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Metric label="競合KW" value={analysis.organicKeywords.length} suffix="件" />
        <Metric label="検出ドメイン" value={competitors.filter(item => item.domain !== 'ドメイン未取得').length} suffix="件" />
        <Metric label="上位10位以内" value={analysis.organicKeywords.filter(keyword => (keyword.position ?? 999) <= 10).length} suffix="KW" accent />
      </div>

      {analysis.organicKeywords.length === 0 && !loading ? (
        <div className="rounded-xl border border-dashed border-[#C4A0A6] bg-white p-10 text-center">
          <p className="font-bold text-[#222222]">競合のOrganic Keywords CSVをインポートしてください</p>
          <p className="mt-2 text-sm text-[#64748B]">Ahrefsで競合サイトごとに出力したCSVを追加すると、ドメイン別に分析できます。</p>
          <Link href="/ahrefs" className="mt-5 inline-flex rounded-lg bg-[#8B1A2A] px-4 py-2 text-sm font-semibold text-white hover:opacity-90">CSVをインポートする</Link>
        </div>
      ) : (
        <section className="rounded-xl border border-[#E8D5D8] bg-white p-5">
          <div className="mb-4 flex items-center gap-2">
            <Target size={19} className="text-[#8B1A2A]" />
            <div>
              <h2 className="font-bold text-[#222222]">ドメイン別の獲得キーワード</h2>
              <p className="text-xs text-[#64748B]">順位が高いキーワードを優先して表示しています。</p>
            </div>
          </div>
          <div className="space-y-3">
            {competitors.map(competitor => (
              <div key={competitor.domain} className="rounded-lg border border-[#E8D5D8] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-[#222222]">{competitor.domain}</p>
                    <p className="mt-1 text-xs text-[#64748B]">検出KW {competitor.keywordCount.toLocaleString()}件{competitor.estimatedTraffic > 0 && ` / 推定流入 ${competitor.estimatedTraffic.toLocaleString()}`}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#FDF5F6] px-2.5 py-1 text-xs font-bold text-[#8B1A2A]"><TrendingUp size={12} />上位KW</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {competitor.topKeywords.map(keyword => (
                    <span key={`${competitor.domain}-${keyword.keyword}`} className="rounded-md bg-[#FAF8F5] px-2.5 py-1.5 text-xs text-[#475569]">
                      <strong className="text-[#222222]">{keyword.keyword}</strong>{keyword.position != null && `　${keyword.position}位`}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <Link href="/ahrefs" className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-[#8B1A2A] hover:underline">競合KWを詳細で見る <ExternalLink size={14} /></Link>
        </section>
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
