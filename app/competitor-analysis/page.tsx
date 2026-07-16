'use client'

import { useCallback, useEffect, useState } from 'react'
import { Building2, Crosshair, Lightbulb, RefreshCw, Search, Sparkles } from 'lucide-react'

type Tab = 'competitors' | 'comparison' | 'strategy'

interface Competitor {
  id: string
  name: string
  domain: string
  type: 'direct' | 'indirect'
  note: string
  url: string
}

interface Fact { text: string; sourceUrl: string; confirmedAt: string }
interface Result {
  axes?: Record<'message' | 'pricing' | 'offering' | 'positioning' | 'authority', Fact[]>
  keywords?: { keyword: string; volume: number; position: number | null; traffic: number | null; url: string }[]
  updatedAt: string
  keywordUpdatedAt?: string
}
interface Opportunity {
  keyword: string
  volume: number
  competitors: { name: string; position: number | null; url: string }[]
  selfPosition: number | null
  opportunity: 'gap' | 'weak'
}
interface Action {
  title: string
  description: string
  priority: 'high' | 'medium'
  category: string
  target: string
  kpi: string
}
interface Data {
  config: Competitor[]
  document: { competitors: Record<string, Result>; selfKeywords: unknown[]; actions?: Action[] }
  opportunities: Opportunity[]
  usage: { units_used_this_month: number; units_limit_per_month: number } | null
  error?: string
}

const tabs: { id: Tab; label: string }[] = [
  { id: 'competitors', label: '競合一覧' },
  { id: 'comparison', label: '比較・機会' },
  { id: 'strategy', label: '戦略・施策' },
]

export default function CompetitorAnalysisPage() {
  const [data, setData] = useState<Data | null>(null)
  const [tab, setTab] = useState<Tab>('competitors')
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/competitive-analysis', { cache: 'no-store' })
      const body = await response.json() as Data
      if (!response.ok) throw new Error(body.error ?? '競合分析データを取得できませんでした')
      setData(body)
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '競合分析データを取得できませんでした')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const run = async (action: string, competitorId?: string) => {
    setRunning(`${action}:${competitorId ?? ''}`)
    setError(null)
    try {
      const response = await fetch('/api/competitive-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, competitorId }),
      })
      const body = await response.json() as { error?: string }
      if (!response.ok) throw new Error(body.error ?? '処理に失敗しました')
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '処理に失敗しました')
    } finally {
      setRunning(null)
    }
  }

  return (
    <div className="w-full max-w-6xl py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-bold tracking-[0.16em] text-[#97876A]">M&amp;A LOYAL MARKET INTELLIGENCE</p>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-[#222222]"><Building2 size={25} className="text-[#8B1A2A]" />競合分析・戦略提案</h1>
          <p className="mt-1 text-sm text-[#64748B]">競合の公式情報とAhrefsデータをもとに、M&amp;Aロイヤルの優先施策を整理します。</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading || !!running} className="inline-flex items-center gap-1.5 rounded-lg bg-[#8B1A2A] px-3.5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />更新
        </button>
      </div>

      {data?.usage && <p className="mb-4 text-right text-xs text-[#64748B]">Ahrefs利用量: {data.usage.units_used_this_month.toLocaleString()} / {data.usage.units_limit_per_month.toLocaleString()} units</p>}
      {error && <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <div className="mb-6 flex border-b border-[#E8D5D8]">
        {tabs.map(item => (
          <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`relative px-5 py-3 text-sm font-bold ${tab === item.id ? 'text-[#8B1A2A]' : 'text-[#64748B] hover:text-[#222222]'}`}>
            {item.label}{tab === item.id && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#8B1A2A]" />}
          </button>
        ))}
      </div>

      {loading ? <p className="py-12 text-center text-sm text-[#64748B]">読み込み中...</p> : (
        <>
          {tab === 'competitors' && <CompetitorsTab data={data} running={running} run={run} />}
          {tab === 'comparison' && <ComparisonTab data={data} />}
          {tab === 'strategy' && <StrategyTab data={data} running={running} run={run} />}
        </>
      )}
    </div>
  )
}

function CompetitorsTab({ data, running, run }: { data: Data | null; running: string | null; run: (action: string, id?: string) => Promise<void> }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#E8D5D8] bg-[#FDF5F6] p-4 text-sm text-[#6B4C50]">
        <strong>収集手順：</strong>「公式情報を収集」で5軸の一次情報を整理し、「Ahrefs KWを取得」で競合と自社の検索KWを同期します。
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {data?.config.map(competitor => {
          const result = data.document.competitors[competitor.id]
          return (
            <article key={competitor.id} className="rounded-xl border border-[#E8D5D8] bg-white p-5">
              <div className="flex items-start justify-between gap-3">
                <div><h2 className="font-bold text-[#222222]">{competitor.name}</h2><p className="mt-1 text-xs text-[#64748B]">{competitor.note}</p></div>
                <span className="rounded-full bg-[#FDF5F6] px-2 py-1 text-[10px] font-bold text-[#8B1A2A]">{competitor.type === 'direct' ? '直接競合' : '間接競合'}</span>
              </div>
              <a href={competitor.url} target="_blank" rel="noreferrer" className="mt-3 block text-xs text-[#8B1A2A] hover:underline">{competitor.url}</a>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <RunButton label="公式情報を収集" active={running === `analyze-competitor:${competitor.id}`} onClick={() => run('analyze-competitor', competitor.id)} />
                <RunButton label="Ahrefs KWを取得" active={running === `refresh-keywords:${competitor.id}`} onClick={() => run('refresh-keywords', competitor.id)} />
              </div>
              <p className="mt-3 text-[11px] text-[#64748B]">公式情報: {result?.updatedAt ? new Date(result.updatedAt).toLocaleDateString('ja-JP') : '未収集'} / KW: {result?.keywords?.length ?? 0}件</p>
            </article>
          )
        })}
      </div>
    </div>
  )
}

function ComparisonTab({ data }: { data: Data | null }) {
  const axes: { key: keyof NonNullable<Result['axes']>; label: string }[] = [
    { key: 'message', label: 'LP・メッセージ' }, { key: 'pricing', label: '価格・報酬' }, { key: 'offering', label: '提供内容' }, { key: 'positioning', label: 'ポジション' }, { key: 'authority', label: '実績・権威性' },
  ]
  return (
    <div className="space-y-6">
      <section className="overflow-x-auto rounded-xl border border-[#E8D5D8] bg-white">
        <table className="w-full min-w-[800px] text-sm">
          <thead><tr className="bg-[#FDF5F6] text-left text-[#64748B]"><th className="p-3">競合</th>{axes.map(axis => <th key={axis.key} className="p-3">{axis.label}</th>)}</tr></thead>
          <tbody>{data?.config.map(competitor => <tr key={competitor.id} className="border-t border-[#E8D5D8] align-top"><td className="p-3 font-bold text-[#222222]">{competitor.name}</td>{axes.map(axis => <td key={axis.key} className="max-w-[190px] p-3 text-xs leading-relaxed text-[#475569]">{data.document.competitors[competitor.id]?.axes?.[axis.key]?.[0]?.text ?? '未収集'}</td>)}</tr>)}</tbody>
        </table>
      </section>
      <section className="rounded-xl border border-[#E8D5D8] bg-white p-5">
        <h2 className="mb-1 flex items-center gap-2 font-bold text-[#222222]"><Search size={18} className="text-[#8B1A2A]" />検索KWの機会</h2>
        <p className="mb-4 text-xs text-[#64748B]">競合が30位以内で、自社が未露出または20位以下のキーワードです。</p>
        {data?.opportunities.length ? <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-sm"><thead><tr className="border-b border-[#E8D5D8] text-left text-xs text-[#64748B]"><th className="p-2">キーワード</th><th className="p-2 text-right">Vol</th><th className="p-2">競合</th><th className="p-2">自社</th><th className="p-2">機会</th></tr></thead><tbody>{data.opportunities.slice(0, 20).map(item => <tr key={item.keyword} className="border-b border-[#E8D5D8]"><td className="p-2 font-bold text-[#222222]">{item.keyword}</td><td className="p-2 text-right">{item.volume.toLocaleString()}</td><td className="p-2 text-xs">{item.competitors.map(c => c.name).join('・')}</td><td className="p-2">{item.selfPosition ? `${item.selfPosition}位` : '未露出'}</td><td className="p-2"><span className="rounded bg-[#FDF5F6] px-2 py-1 text-xs font-bold text-[#8B1A2A]">{item.opportunity === 'gap' ? '新規獲得' : '順位改善'}</span></td></tr>)}</tbody></table></div> : <p className="py-6 text-center text-sm text-[#64748B]">競合一覧からAhrefs KWを取得すると表示されます。</p>}
      </section>
    </div>
  )
}

function StrategyTab({ data, running, run }: { data: Data | null; running: string | null; run: (action: string) => Promise<void> }) {
  const actions = data?.document.actions ?? []
  return (
    <section className="rounded-xl border border-[#E8D5D8] bg-white p-5">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 font-bold text-[#222222]"><Lightbulb size={19} className="text-[#8B1A2A]" />M&amp;Aロイヤル向け戦略・施策</h2><p className="mt-1 text-xs text-[#64748B]">競合KWの機会から、完全成功報酬・オーナー伴走型支援を活かす施策を作成します。</p></div><RunButton label="施策を生成" active={running === 'generate-strategy:'} onClick={() => run('generate-strategy')} /></div>
      {actions.length ? <div className="space-y-3">{actions.map(action => <div key={action.title} className="rounded-lg border border-[#E8D5D8] bg-[#FAF8F5] p-4"><div className="flex flex-wrap items-center gap-2"><span className={`rounded px-2 py-0.5 text-[10px] font-bold ${action.priority === 'high' ? 'bg-[#8B1A2A] text-white' : 'bg-[#E8D5D8] text-[#6B4C50]'}`}>{action.priority === 'high' ? '最優先' : '優先'}</span><span className="text-xs text-[#64748B]">{action.category}</span></div><h3 className="mt-2 font-bold text-[#222222]">{action.title}</h3><p className="mt-1 text-sm leading-relaxed text-[#475569]">{action.description}</p><p className="mt-2 text-xs text-[#64748B]">対象: {action.target} / KPI: {action.kpi}</p></div>)}</div> : <div className="py-10 text-center"><Sparkles className="mx-auto mb-3 text-[#C4A0A6]" size={34} /><p className="text-sm text-[#64748B]">競合KWを同期後、「施策を生成」を実行してください。</p></div>}
    </section>
  )
}

function RunButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return <button type="button" disabled={active} onClick={() => void onClick()} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#8B1A2A] px-3 py-2 text-xs font-bold text-[#8B1A2A] hover:bg-[#8B1A2A] hover:text-white disabled:opacity-50"><Crosshair size={13} />{active ? '実行中...' : label}</button>
}
