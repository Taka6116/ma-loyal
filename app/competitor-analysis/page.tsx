'use client'

import { useCallback, useEffect, useState } from 'react'
import { BarChart3, Building2, CheckCircle2, Crosshair, ExternalLink, History, Lightbulb, Loader2, RefreshCw, Search, Target } from 'lucide-react'

type Tab = 'competitors' | 'comparison' | 'strategy'

interface Competitor {
  id: string
  name: string
  domain: string
  type: 'direct' | 'indirect'
  note: string
  urls: { url: string; label: string }[]
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
  priority: 'high' | 'medium' | 'low'
  phase: 'awareness' | 'research' | 'comparison' | 'decision'
  category: string
  target: string
  kpi: string
}
interface Report {
  generatedAt: string
  summary: string
  observedFacts: string[]
  opportunities: string[]
  positioning: { xAxis: string; yAxis: string; points: { name: string; x: number; y: number; rationale: string; isSelf?: boolean }[]; whitespace: string }
  funnelCoverage: { phase: Action['phase']; self: string; competitor: string; implication: string }[]
  actions: Action[]
  caveats: string[]
}
interface Data {
  config: Competitor[]
  document: { updatedAt: string; competitors: Record<string, Result>; selfKeywords: unknown[]; report?: Report }
  history: { date: string; savedAt: string; document: Data['document'] }[]
  opportunities: Opportunity[]
  usage: { units_used_this_month: number; units_limit_per_month: number } | null
  error?: string
}

const tabs: { id: Tab; label: string }[] = [
  { id: 'competitors', label: '競合一覧' },
  { id: 'comparison', label: '比較・機会' },
  { id: 'strategy', label: '戦略・施策' },
]

const axes = [
  { key: 'message', label: 'LP・メッセージ' },
  { key: 'pricing', label: '価格・利用条件' },
  { key: 'offering', label: '機能・提供範囲' },
  { key: 'positioning', label: 'ポジショニング' },
  { key: 'authority', label: '集客・権威性' },
] as const

export default function CompetitorAnalysisPage() {
  const [data, setData] = useState<Data | null>(null)
  const [tab, setTab] = useState<Tab>('competitors')
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [viewDate, setViewDate] = useState('latest')
  const [urlDrafts, setUrlDrafts] = useState<Record<string, { label: string; url: string }>>({})

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

  const analyzeAll = async () => {
    if (!data) return
    setRunning('analyze-all')
    setError(null)
    try {
      for (const competitor of data.config) {
        const response = await fetch('/api/competitive-analysis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'analyze-competitor', competitorId: competitor.id }),
        })
        const body = await response.json() as { error?: string }
        if (!response.ok) throw new Error(`${competitor.name}: ${body.error ?? '分析に失敗しました'}`)
      }
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '全競合の分析に失敗しました')
    } finally {
      setRunning(null)
    }
  }

  const addUrl = async (competitor: Competitor) => {
    if (!data) return
    const draft = urlDrafts[competitor.id]
    if (!draft?.url.trim()) return
    setRunning(`save-config:${competitor.id}`)
    try {
      const parsed = new URL(draft.url.trim())
      if (parsed.protocol !== 'https:' || !(parsed.hostname === competitor.domain || parsed.hostname.endsWith(`.${competitor.domain}`))) {
        throw new Error(`${competitor.domain} 配下のHTTPS URLを指定してください`)
      }
      const config = data.config.map(item => item.id === competitor.id
        ? { ...item, urls: [...item.urls, { url: parsed.toString(), label: draft.label.trim() || '監視ページ' }] }
        : item)
      const response = await fetch('/api/competitive-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save-config', config }),
      })
      const body = await response.json() as { error?: string }
      if (!response.ok) throw new Error(body.error ?? 'URLの保存に失敗しました')
      setUrlDrafts(previous => ({ ...previous, [competitor.id]: { label: '', url: '' } }))
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'URLの保存に失敗しました')
    } finally {
      setRunning(null)
    }
  }

  const viewedDocument = viewDate === 'latest'
    ? data?.document
    : data?.history.find(item => item.date === viewDate)?.document ?? data?.document
  const viewedData = data && viewedDocument ? { ...data, document: viewedDocument } : data

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

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-[#E8D5D8]">
        <div className="flex">{tabs.map(item => (
          <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`relative px-5 py-3 text-sm font-bold ${tab === item.id ? 'text-[#8B1A2A]' : 'text-[#64748B] hover:text-[#222222]'}`}>
            {item.label}{tab === item.id && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#8B1A2A]" />}
          </button>
        ))}</div>
        <div className="flex items-center gap-1 pb-2 text-xs text-[#64748B]">
          <History size={13} /><button onClick={() => setViewDate('latest')} className={`rounded-full px-2.5 py-1 font-bold ${viewDate === 'latest' ? 'bg-[#8B1A2A] text-white' : 'bg-[#FAF8F5]'}`}>最新</button>
          {data?.history.map(item => <button key={item.date} onClick={() => setViewDate(item.date)} className={`rounded-full px-2.5 py-1 font-bold ${viewDate === item.date ? 'bg-[#8B1A2A] text-white' : 'bg-[#FAF8F5]'}`}>{item.date.slice(5).replace('-', '/')}</button>)}
        </div>
      </div>

      {loading ? <p className="py-12 text-center text-sm text-[#64748B]">読み込み中...</p> : (
        <>
          {viewDate !== 'latest' && <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">過去の分析結果を表示しています。</p>}
          {tab === 'competitors' && <CompetitorsTab data={viewedData} running={running} run={run} analyzeAll={analyzeAll} addUrl={addUrl} urlDrafts={urlDrafts} setUrlDrafts={setUrlDrafts} historical={viewDate !== 'latest'} />}
          {tab === 'comparison' && <ComparisonTab data={viewedData} />}
          {tab === 'strategy' && <StrategyTab data={viewedData} running={running} run={run} historical={viewDate !== 'latest'} />}
        </>
      )}
    </div>
  )
}

function CompetitorsTab({
  data, running, run, analyzeAll, addUrl, urlDrafts, setUrlDrafts, historical,
}: {
  data: Data | null
  running: string | null
  run: (action: string, id?: string) => Promise<void>
  analyzeAll: () => Promise<void>
  addUrl: (competitor: Competitor) => Promise<void>
  urlDrafts: Record<string, { label: string; url: string }>
  setUrlDrafts: React.Dispatch<React.SetStateAction<Record<string, { label: string; url: string }>>>
  historical: boolean
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#E8D5D8] bg-gradient-to-r from-[#FDF5F6] to-[#F5F0E8] p-5">
        <div><p className="font-bold text-[#222222]">第1段階: 公式情報を5軸で収集</p><p className="mt-1 text-xs text-[#64748B]">登録URLを確認し、訴求・価格・提供範囲・立ち位置・権威性の観測事実を表示します。</p></div>
        <button type="button" onClick={() => void analyzeAll()} disabled={!!running || historical} className="inline-flex items-center gap-2 rounded-lg bg-[#8B1A2A] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">
          {running === 'analyze-all' ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}{running === 'analyze-all' ? '全社を分析中...' : '全競合を分析'}
        </button>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {data?.config.map(competitor => {
          const result = data.document.competitors[competitor.id]
          return (
            <article key={competitor.id} className="rounded-xl border border-[#E8D5D8] bg-white p-5">
              <div className="flex items-start justify-between gap-3">
                <div><h2 className="font-bold text-[#222222]">{competitor.name}</h2><p className="mt-1 text-xs text-[#64748B]">{competitor.note}</p></div>
                <div className="flex items-center gap-2"><span className="rounded-full bg-[#FDF5F6] px-2 py-1 text-[10px] font-bold text-[#8B1A2A]">{competitor.type === 'direct' ? '直接競合' : '間接競合'}</span>{result?.axes && <CheckCircle2 size={17} className="text-emerald-600" />}</div>
              </div>
              <div className="mt-3 space-y-1">{competitor.urls.map(page => <a key={page.url} href={page.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[11px] text-[#8B1A2A] hover:underline"><ExternalLink size={11} />{page.label}: {page.url}</a>)}</div>
              {!historical && <div className="mt-3 flex gap-1.5">
                <input value={urlDrafts[competitor.id]?.label ?? ''} onChange={event => setUrlDrafts(previous => ({ ...previous, [competitor.id]: { label: event.target.value, url: previous[competitor.id]?.url ?? '' } }))} placeholder="ページ名（任意）" className="w-28 rounded-md border border-[#E8D5D8] px-2 py-1.5 text-[11px]" />
                <input value={urlDrafts[competitor.id]?.url ?? ''} onChange={event => setUrlDrafts(previous => ({ ...previous, [competitor.id]: { label: previous[competitor.id]?.label ?? '', url: event.target.value } }))} placeholder="追加監視URL" className="min-w-0 flex-1 rounded-md border border-[#E8D5D8] px-2 py-1.5 text-[11px]" />
                <button onClick={() => void addUrl(competitor)} disabled={!!running} className="rounded-md bg-[#FAF8F5] px-2 text-[11px] font-bold text-[#6B4C50] disabled:opacity-50">URL追加</button>
              </div>}
              <div className="mt-4 space-y-2.5">
                {axes.map(axis => <div key={axis.key}><p className="text-[11px] font-bold text-[#64748B]">{axis.label}</p><p className="text-xs leading-relaxed text-[#222222]">{result?.axes?.[axis.key]?.[0]?.text ?? '公式ページから未確認'}</p></div>)}
              </div>
              {result?.keywords && result.keywords.length > 0 && <div className="mt-4 rounded-lg border border-[#E8D5D8] bg-[#FAF8F5] p-3">
                <p className="mb-2 flex items-center gap-1 text-[11px] font-bold text-[#6B4C50]"><BarChart3 size={13} />取得済みKW（上位5件）</p>
                <div className="space-y-1.5">{result.keywords.slice(0, 5).map(keyword => <div key={keyword.keyword} className="flex items-center justify-between gap-2 text-[11px]"><span className="min-w-0 truncate font-semibold text-[#222222]">{keyword.keyword}</span><span className="shrink-0 text-[#64748B]">{keyword.position != null ? `${keyword.position}位` : '順位未取得'} / Vol {keyword.volume.toLocaleString()}</span></div>)}</div>
              </div>}
              <p className="mt-3 text-[10px] text-[#94A3B8]">確認: {result?.updatedAt ? new Date(result.updatedAt).toLocaleString('ja-JP') : '未実行'} / Tier 1: 公式サイト</p>
              <div className="mt-4 flex gap-2">
                <RunButton label={result?.axes ? '再収集' : '公式情報を収集'} active={running === `analyze-competitor:${competitor.id}`} disabled={historical || !!running} onClick={() => run('analyze-competitor', competitor.id)} />
                <RunButton label={result?.keywords ? `Ahrefs更新（${result.keywords.length}KW）` : 'Ahrefs KWを取得'} active={running === `refresh-keywords:${competitor.id}`} disabled={historical || !!running} icon="chart" onClick={() => run('refresh-keywords', competitor.id)} />
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}

function ComparisonTab({ data }: { data: Data | null }) {
  const hasCompetitorKeywords = Boolean(data?.config.some(competitor => (data.document.competitors[competitor.id]?.keywords?.length ?? 0) > 0))
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[#E8D5D8] bg-gradient-to-r from-[#FDF5F6] to-[#F5F0E8] p-5"><p className="font-bold text-[#222222]">第2段階: 競合の強みと検索機会</p><p className="mt-1 text-xs text-[#64748B]">競合公式サイトの観測事実と、Ahrefsのドメイン別KWを自社データと照合します。</p></div>
      <section className="overflow-x-auto rounded-xl border border-[#E8D5D8] bg-white">
        <table className="w-full min-w-[800px] text-sm">
          <thead><tr className="bg-[#FDF5F6] text-left text-[#64748B]"><th className="p-3">競合</th>{axes.map(axis => <th key={axis.key} className="p-3">{axis.label}</th>)}</tr></thead>
          <tbody>{data?.config.map(competitor => <tr key={competitor.id} className="border-t border-[#E8D5D8] align-top"><td className="p-3 font-bold text-[#222222]">{competitor.name}</td>{axes.map(axis => <td key={axis.key} className="max-w-[190px] p-3 text-xs leading-relaxed text-[#475569]">{data.document.competitors[competitor.id]?.axes?.[axis.key]?.[0]?.text ?? '未収集'}</td>)}</tr>)}</tbody>
        </table>
      </section>
      <section className="rounded-xl border border-[#E8D5D8] bg-white p-5">
        <h2 className="mb-1 flex items-center gap-2 font-bold text-[#222222]"><Search size={18} className="text-[#8B1A2A]" />検索KWの機会</h2>
        <p className="mb-4 text-xs text-[#64748B]">競合が30位以内で、自社が未露出または20位以下のキーワードです。</p>
        {data?.opportunities.length ? <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-sm"><thead><tr className="border-b border-[#E8D5D8] text-left text-xs text-[#64748B]"><th className="p-2">キーワード</th><th className="p-2 text-right">Vol</th><th className="p-2">競合</th><th className="p-2">自社</th><th className="p-2">機会</th></tr></thead><tbody>{data.opportunities.slice(0, 20).map(item => <tr key={item.keyword} className="border-b border-[#E8D5D8]"><td className="p-2 font-bold text-[#222222]">{item.keyword}</td><td className="p-2 text-right">{item.volume.toLocaleString()}</td><td className="p-2 text-xs">{item.competitors.map(c => c.name).join('・')}</td><td className="p-2">{item.selfPosition ? `${item.selfPosition}位` : '未露出'}</td><td className="p-2"><span className="rounded bg-[#FDF5F6] px-2 py-1 text-xs font-bold text-[#8B1A2A]">{item.opportunity === 'gap' ? '新規獲得' : '順位改善'}</span></td></tr>)}</tbody></table></div> : <p className="py-6 text-center text-sm text-[#64748B]">{hasCompetitorKeywords ? '取得済みKWに、現在の抽出条件に合う機会はありません。' : '競合一覧で「Ahrefs KWを取得」を実行すると表示されます。'}</p>}
      </section>
    </div>
  )
}

function StrategyTab({ data, running, run, historical }: { data: Data | null; running: string | null; run: (action: string) => Promise<void>; historical: boolean }) {
  const report = data?.document.report
  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#E8D5D8] bg-gradient-to-r from-[#FDF5F6] to-[#F5F0E8] p-5">
        <div><h2 className="flex items-center gap-2 font-bold text-[#222222]"><Lightbulb size={19} className="text-[#8B1A2A]" />第3段階: M&amp;Aロイヤルの戦略・施策へ翻訳</h2><p className="mt-1 text-xs text-[#64748B]">競合の観測事実と検索機会を統合し、差別化機会と実行順を提案します。</p></div>
        <RunButton label={report ? '戦略を再生成' : '戦略・施策を生成'} active={running === 'generate-strategy:'} disabled={historical || !!running} onClick={() => run('generate-strategy')} />
      </section>
      {!report ? <div className="rounded-xl border border-dashed border-[#E8D5D8] bg-white py-14 text-center"><BarChart3 className="mx-auto mb-3 text-[#C4A0A6]" size={34} /><p className="text-sm text-[#64748B]">競合情報とKWを同期後、「戦略・施策を生成」を実行してください。</p></div> : <>
        <section className="rounded-xl border border-[#E8D5D8] bg-white p-6"><p className="text-xs font-bold text-[#8B1A2A]">結論: M&amp;Aロイヤルが取るべき方向</p><p className="mt-2 text-sm leading-relaxed text-[#222222]">{report.summary}</p></section>
        <div className="grid gap-4 lg:grid-cols-2">
          <BulletCard title="観測事実" items={report.observedFacts} />
          <BulletCard title="差別化の機会" items={report.opportunities} />
        </div>
        <section className="rounded-xl border border-[#E8D5D8] bg-white p-5"><h2 className="font-bold text-[#222222]">ポジショニングマップ</h2><p className="mt-1 text-xs text-[#64748B]">横軸: {report.positioning.xAxis} ／ 縦軸: {report.positioning.yAxis}</p><div className="relative mt-4 h-72 overflow-hidden rounded-lg border border-[#E8D5D8] bg-gradient-to-br from-[#FAF8F5] to-[#FDF5F6]"><div className="absolute inset-y-0 left-1/2 border-l border-[#E8D5D8]" /><div className="absolute inset-x-0 top-1/2 border-t border-[#E8D5D8]" />{report.positioning.points.map(point => <div key={point.name} title={point.rationale} className={`absolute -translate-x-1/2 translate-y-1/2 rounded-full px-2.5 py-1 text-[10px] font-bold text-white ${point.isSelf ? 'bg-[#8B1A2A]' : 'bg-[#64748B]'}`} style={{ left: `${point.x}%`, bottom: `${point.y}%` }}>{point.name}</div>)}</div><p className="mt-3 text-xs text-[#64748B]"><strong>狙う空白領域:</strong> {report.positioning.whitespace}</p></section>
        <section className="rounded-xl border border-[#E8D5D8] bg-white p-5"><h2 className="mb-4 font-bold text-[#222222]">ファネル別の競争状況</h2><div className="grid gap-3 md:grid-cols-4">{report.funnelCoverage.map(item => <div key={item.phase} className="overflow-hidden rounded-lg border border-[#E8D5D8]"><p className="bg-[#8B1A2A] px-3 py-2 text-xs font-bold text-white">{phaseLabel(item.phase)}</p><div className="space-y-2 p-3 text-[11px] leading-relaxed"><p><strong>自社:</strong> {item.self}</p><p><strong>競合:</strong> {item.competitor}</p><p className="text-[#64748B]">{item.implication}</p></div></div>)}</div></section>
        <section className="rounded-xl border border-[#E8D5D8] bg-white p-5"><h2 className="mb-4 font-bold text-[#222222]">実行する施策</h2><div className="grid gap-4 lg:grid-cols-3">{(['high', 'medium', 'low'] as const).map(priority => <div key={priority}><p className={`rounded-t-lg px-3 py-2 text-xs font-bold text-white ${priority === 'high' ? 'bg-[#8B1A2A]' : priority === 'medium' ? 'bg-[#B7791F]' : 'bg-[#64748B]'}`}>{priority === 'high' ? '優先度 高' : priority === 'medium' ? '優先度 中' : '優先度 低'}</p><div className="min-h-24 space-y-2 rounded-b-lg border border-t-0 border-[#E8D5D8] bg-[#FAF8F5] p-2">{report.actions.filter(action => action.priority === priority).map(action => <div key={action.title} className="rounded-md bg-white p-3"><p className="flex items-center gap-1 text-xs font-bold text-[#222222]"><Target size={12} className="text-[#8B1A2A]" />{action.title}</p><p className="mt-1 text-[11px] text-[#64748B]">{action.description}</p><p className="mt-2 text-[10px]">対象: {action.target}<br />KPI: {action.kpi}</p></div>)}</div></div>)}</div></section>
      </>}
    </div>
  )
}

function BulletCard({ title, items }: { title: string; items: string[] }) {
  return <section className="rounded-xl border border-[#E8D5D8] bg-white p-5"><h2 className="mb-3 font-bold text-[#222222]">{title}</h2><ul className="space-y-2">{items.map((item, index) => <li key={index} className="flex gap-2 text-xs leading-relaxed text-[#475569]"><CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-600" />{item}</li>)}</ul></section>
}

function phaseLabel(phase: Action['phase']) {
  return ({ awareness: '認知', research: '情報収集', comparison: '比較検討', decision: '意思決定' } as const)[phase]
}

function RunButton({ label, active, disabled = false, icon = 'target', onClick }: { label: string; active: boolean; disabled?: boolean; icon?: 'target' | 'chart'; onClick: () => void }) {
  return <button type="button" disabled={disabled || active} onClick={() => void onClick()} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#8B1A2A] px-3 py-2 text-xs font-bold text-[#8B1A2A] hover:bg-[#8B1A2A] hover:text-white disabled:opacity-50">{icon === 'chart' ? <BarChart3 size={13} /> : <Crosshair size={13} />}{active ? '実行中...' : label}</button>
}
