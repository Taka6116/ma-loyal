'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, ClipboardCheck, Gauge, Loader2, RefreshCw, Search, ShieldCheck } from 'lucide-react'

type Phase = 'entrance' | 'awareness' | 'research' | 'comparison' | 'conversion' | 'other'
type Priority = 'high' | 'medium' | 'low'
interface Tech { httpStatus: number; title: string; titleLength: number; metaDescription: string; metaDescriptionLength: number; h1Texts: string[]; h2Count: number; h3Count: number; textLength: number; imagesTotal: number; imagesMissingAlt: number; internalLinks: number; externalLinks: number; canonicalUrl: string; hasOgp: boolean; structuredDataTypes: string[]; isNoindex: boolean }
interface PageResult { url: string; label: string; phase: Phase; generatedAt: string; tech: Tech; ai: { score: number; summary: string; issues: string[]; actions: { title: string; description: string; priority: Priority }[] } }
interface Page { url: string; label: string; phase: Phase }
interface Overall { generatedAt: string; summary: string; issues: string[]; actions: { title: string; description: string; priority: Priority; category: string }[] }
interface Data { doc: { pages: Record<string, PageResult>; overall?: Overall }; history: unknown[]; defaultPages: Page[]; error?: string }

const phaseLabel: Record<Phase, string> = { entrance: '入口', awareness: '認知', research: '情報収集', comparison: '比較検討', conversion: 'CV', other: 'その他' }

export default function SiteAuditPage() {
  const [data, setData] = useState<Data | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [customUrl, setCustomUrl] = useState('')
  const [customLabel, setCustomLabel] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/site-audit', { cache: 'no-store' })
      const body = await response.json() as Data
      if (!response.ok) throw new Error(body.error ?? '診断データを取得できませんでした')
      setData(body)
      setSelected(current => current.length ? current : body.defaultPages.map(page => page.url))
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '診断データを取得できませんでした')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const pages = useMemo(() => {
    const defaults = data?.defaultPages ?? []
    const saved = Object.values(data?.doc.pages ?? {}).map(page => ({ url: page.url, label: page.label, phase: page.phase }))
    return [...defaults, ...saved.filter(page => !defaults.some(defaultPage => defaultPage.url === page.url))]
  }, [data])
  const results = Object.values(data?.doc.pages ?? {})
  const average = results.length ? Math.round(results.reduce((sum, page) => sum + page.ai.score, 0) / results.length) : 0

  const runAudit = async () => {
    const targets = pages.filter(page => selected.includes(page.url))
    if (!targets.length) return setError('診断するページを選択してください')
    setRunning('pages'); setError(null)
    try {
      for (const page of targets) {
        const response = await fetch('/api/site-audit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'page', ...page }) })
        const body = await response.json() as { error?: string }
        if (!response.ok) throw new Error(`${page.label}: ${body.error ?? '診断に失敗しました'}`)
      }
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '診断に失敗しました')
    } finally { setRunning(null) }
  }

  const runOverall = async () => {
    setRunning('overall'); setError(null)
    try {
      const response = await fetch('/api/site-audit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'overall' }) })
      const body = await response.json() as { error?: string }
      if (!response.ok) throw new Error(body.error ?? '総合サマリの作成に失敗しました')
      await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : '総合サマリの作成に失敗しました') } finally { setRunning(null) }
  }

  const addCustom = () => {
    try {
      const url = new URL(customUrl)
      if (url.protocol !== 'https:' || !(url.hostname === 'ma-la.co.jp' || url.hostname.endsWith('.ma-la.co.jp'))) throw new Error('ma-la.co.jp 配下のHTTPS URLを指定してください')
      setSelected(current => [...new Set([...current, url.toString()])])
      setData(current => current ? { ...current, defaultPages: [...current.defaultPages, { url: url.toString(), label: customLabel || url.pathname || 'カスタムページ', phase: 'other' }] } : current)
      setCustomUrl(''); setCustomLabel('')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'URLが不正です') }
  }

  return <div className="w-full max-w-6xl py-8">
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4"><div><p className="mb-1 text-xs font-bold tracking-[0.16em] text-[#97876A]">M&amp;A LOYAL WEBSITE DIAGNOSTICS</p><h1 className="flex items-center gap-2 text-2xl font-bold text-[#222222]"><ClipboardCheck size={25} className="text-[#8B1A2A]" />サイト診断</h1><p className="mt-1 text-sm text-[#64748B]">ma-la.co.jpの技術SEO・コンテンツ構造・CV導線をページ単位で診断します。</p></div><button onClick={() => void load()} disabled={loading || !!running} className="inline-flex items-center gap-1.5 rounded-lg bg-[#8B1A2A] px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-50"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} />更新</button></div>
    {error && <p className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
    {loading ? <p className="py-16 text-center text-sm text-[#64748B]">読み込み中...</p> : <div className="space-y-6">
      <section className="rounded-xl border border-[#E8D5D8] bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="font-bold text-[#222222]">診断対象ページ</h2><p className="mt-1 text-xs text-[#64748B]">選択したページを1件ずつ診断します。</p></div><button onClick={() => void runAudit()} disabled={!!running} className="inline-flex items-center gap-2 rounded-lg bg-[#8B1A2A] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{running === 'pages' ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}{running === 'pages' ? '診断中...' : `選択した${selected.length}ページを診断`}</button></div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{pages.map(page => <label key={page.url} className="flex items-center gap-2 rounded-lg border border-[#E8D5D8] p-3 text-sm"><input type="checkbox" checked={selected.includes(page.url)} onChange={() => setSelected(current => current.includes(page.url) ? current.filter(url => url !== page.url) : [...current, page.url])} /><span className="min-w-0 flex-1 truncate font-semibold text-[#222222]">{page.label}</span><span className="text-[10px] text-[#64748B]">{phaseLabel[page.phase]}</span></label>)}</div>
        <div className="mt-4 flex flex-wrap gap-2"><input value={customLabel} onChange={event => setCustomLabel(event.target.value)} placeholder="ページ名（任意）" className="w-40 rounded-md border border-[#E8D5D8] px-3 py-2 text-xs" /><input value={customUrl} onChange={event => setCustomUrl(event.target.value)} placeholder="https://ma-la.co.jp/..." className="min-w-60 flex-1 rounded-md border border-[#E8D5D8] px-3 py-2 text-xs" /><button onClick={addCustom} className="rounded-md bg-[#FAF8F5] px-3 py-2 text-xs font-bold text-[#6B4C50]">URL追加</button></div>
      </section>
      <div className="grid gap-4 lg:grid-cols-3"><section className="rounded-xl border border-[#E8D5D8] bg-white p-5"><p className="text-xs font-bold text-[#64748B]">診断済みページ</p><p className="mt-1 text-3xl font-bold text-[#222222]">{results.length}<span className="ml-1 text-xs text-[#64748B]">件</span></p></section><section className="rounded-xl border border-[#E8D5D8] bg-white p-5"><p className="text-xs font-bold text-[#64748B]">サイト平均スコア</p><p className="mt-1 flex items-center gap-2 text-3xl font-bold text-[#8B1A2A]"><Gauge size={27} />{average}<span className="text-xs text-[#64748B]">/100</span></p></section><section className="rounded-xl border border-[#E8D5D8] bg-white p-5"><p className="text-xs font-bold text-[#64748B]">総合サマリ</p><button onClick={() => void runOverall()} disabled={!results.length || !!running} className="mt-2 rounded-md border border-[#8B1A2A] px-3 py-1.5 text-xs font-bold text-[#8B1A2A] disabled:opacity-50">{running === 'overall' ? '作成中...' : '作成する'}</button></section></div>
      {data?.doc.overall && <section className="rounded-xl border border-[#E8D5D8] bg-[#FDF5F6] p-5"><h2 className="font-bold text-[#222222]">サイト全体の総評</h2><p className="mt-2 text-sm leading-relaxed text-[#475569]">{data.doc.overall.summary}</p><div className="mt-4 grid gap-3 md:grid-cols-2">{data.doc.overall.actions.map(action => <div key={action.title} className="rounded-lg border border-[#E8D5D8] bg-white p-3"><p className="font-bold text-sm text-[#222222]">{action.title}</p><p className="mt-1 text-xs text-[#64748B]">{action.description}</p></div>)}</div></section>}
      <section className="space-y-4">{results.map(result => <PageCard key={result.url} result={result} />)}</section>
    </div>}
  </div>
}

function PageCard({ result }: { result: PageResult }) {
  const { tech, ai } = result
  const chips = [{ label: 'Title', ok: Boolean(tech.title) }, { label: 'Meta', ok: Boolean(tech.metaDescription) }, { label: 'H1', ok: tech.h1Texts.length === 1 }, { label: 'alt', ok: tech.imagesMissingAlt === 0 }, { label: 'OGP', ok: tech.hasOgp }, { label: '構造化', ok: tech.structuredDataTypes.length > 0 }, { label: 'noindex', ok: !tech.isNoindex }]
  return <article className="rounded-xl border border-[#E8D5D8] bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="font-bold text-[#222222]">{result.label}</p><a href={result.url} target="_blank" rel="noreferrer" className="mt-1 block text-xs text-[#8B1A2A] hover:underline">{result.url}</a></div><div className="text-right"><p className={`text-3xl font-bold ${ai.score >= 80 ? 'text-emerald-600' : ai.score >= 60 ? 'text-amber-600' : 'text-red-600'}`}>{ai.score}<span className="text-xs text-[#64748B]"> /100</span></p><span className="text-[10px] text-[#64748B]">{phaseLabel[result.phase]}</span></div></div><div className="mt-4 flex flex-wrap gap-1.5">{chips.map(chip => <span key={chip.label} className={`rounded-full px-2 py-1 text-[10px] font-bold ${chip.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{chip.ok ? <CheckCircle2 className="mr-1 inline" size={11} /> : <AlertTriangle className="mr-1 inline" size={11} />}{chip.label}</span>)}</div><p className="mt-4 text-sm leading-relaxed text-[#475569]">{ai.summary}</p>{ai.issues.length > 0 && <div className="mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-800">{ai.issues.map(issue => <p key={issue}>・{issue}</p>)}</div>}<div className="mt-4 grid gap-2 md:grid-cols-2">{ai.actions.map(action => <div key={action.title} className="rounded-lg bg-[#FAF8F5] p-3"><p className="flex items-center gap-1 text-xs font-bold text-[#222222]"><ShieldCheck size={13} className="text-[#8B1A2A]" />{action.title}</p><p className="mt-1 text-[11px] text-[#64748B]">{action.description}</p></div>)}</div></article>
}
