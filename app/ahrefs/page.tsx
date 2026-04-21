'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, X, Search, Sparkles, Globe, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { AhrefsDataset, AhrefsDatasetType } from '@/lib/ahrefsCsvParser'
import { analyzeKeywords, detectTrends, getCategoryCounts, mergeAndAnalyze, type ScoredKeyword, type TrendKeyword, type CategoryCount, type PriorityLevel } from '@/lib/ahrefsAnalyzer'

const PAGE_SIZE = 50

type TabKey = 'opportunity' | 'organic' | 'trends' | 'all'

interface DatasetMeta {
  id: string
  fileName: string
  type: AhrefsDatasetType
  rowCount: number
  uploadedAt: string
}

function fmtNum(n: number): string { return n.toLocaleString('ja-JP') }
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ja-JP', { year: 'numeric', month: 'numeric', day: 'numeric' })
}

function kdColor(kd: number): string {
  if (kd <= 30) return '#16a34a'
  if (kd <= 60) return '#ca8a04'
  return '#dc2626'
}
function kdBg(kd: number): string {
  if (kd <= 30) return '#f0fdf4'
  if (kd <= 60) return '#fefce8'
  return '#fef2f2'
}

function generateAutoPrompt(row: ScoredKeyword): string {
  const priorityLabels: Record<number, string> = {
    3: '★★★（最優先 — 低難易度・十分なボリューム。上位表示の勝算あり）',
    2: '★★（有望 — 記事計画に入れるべきKW）',
    1: '★（検討中 — 余力があれば着手）',
    0: '（参考レベル）',
  }

  let volumeStrategy = ''
  if (row.volume > 5000) volumeStrategy = '・検索ボリュームが非常に大きいため、包括的かつ網羅的な内容にすること。記事の情報量で勝負'
  else if (row.volume > 1000) volumeStrategy = '・十分な検索ボリュームがあるため、幅広い検索意図をカバーする構成にすること'
  else if (row.volume > 300) volumeStrategy = '・中規模ボリューム。ニッチな専門性と具体性で上位を狙える領域'
  else volumeStrategy = '・ニッチキーワード。深い専門知識と具体的な事例で差別化すること'

  let kdStrategy = ''
  if (row.kd <= 10) kdStrategy = '・競合がほぼ不在。基本を丁寧に押さえつつM&A LOYALの独自事例を入れれば上位表示可能'
  else if (row.kd <= 30) kdStrategy = '・競合難易度が低い。基本を押さえつつM&A LOYALの独自視点（オーナーに寄り添う支援・地域密着型M&A）で差別化すれば上位表示の勝算あり'
  else if (row.kd <= 50) kdStrategy = '・中程度の競合。M&A LOYALの実体験・具体的支援事例で既存記事との差別化が必要'
  else kdStrategy = '・競合が強い領域。M&A LOYALにしか書けない現場知見・独自データで差別化が必須。一般論は避けること'

  let cpcStrategy = ''
  if (row.cpc > 3) cpcStrategy = '\n・CPCが高く商業的意図が強い。CTAへの導線を丁寧に設計し、コンバージョンを意識した構成にすること'
  else if (row.cpc > 0) cpcStrategy = '\n・一定の商業的価値あり。記事末尾のCTAを自然かつ説得力のある形にすること'

  let trendNote = ''
  if (row.trend === 'up') trendNote = '\n・トレンド: 検索需要が上昇中。タイムリーな記事が効果的'
  else if (row.trend === 'down') trendNote = '\n・トレンド: 検索需要は下降傾向。エバーグリーンな切り口を推奨'

  const categoryIntents: Record<string, string> = {
    'M&A基礎': '\n・M&Aとは何か、基本的な仕組みと流れを知りたい',
    '事業承継': '\n・後継者問題を抱えており、事業承継の具体的な方法を知りたい',
    '売却・譲渡': '\n・会社売却・株式譲渡の手続きや価格の決まり方を理解したい',
    '買収・投資': '\n・企業買収の進め方とデューデリジェンスの要点を知りたい',
    'バリュエーション': '\n・自社の企業価値をどう算定するか、相場感を把握したい',
    '仲介・FA': '\n・M&A仲介とFAの違い、どちらを選ぶべきかを理解したい',
    'コスト・費用': '\n・M&A手数料の相場感・成功報酬の仕組みを知りたい',
    '業種別': '\n・自業種のM&A事例と特有の留意点を理解したい',
  }
  const extraIntent = categoryIntents[row.detectedCategory] ?? ''

  return `あなたはM&A・事業承継・企業売却の仲介に特化したSEO・LLMOに強いコンテンツ戦略コンサルタント兼編集者であり、10年以上の実務経験を持ちます。現在はM&Aロイヤルアドバイザリー（M&A LOYAL ADVISORY）のマーケティング兼ライターとして、M&A・事業承継・企業売却領域における検索上位記事の制作を担っています。

単なる情報整理ではなく、経営者・オーナーの実際の悩みに寄り添い、意思決定を前進させる記事設計を行ってください。

■目的

・M&A・事業承継・企業売却の非指名検索ユーザーの流入獲得
・専門性・信頼性・独自性の担保（E-E-A-T強化）
・ユーザーの検索意図（ペイン）の「会社をどう次世代に引き継ぐか、または売却すべきか判断できずにいる」に応える内容にする

■テーマ

「${row.keyword}」

■KWデータに基づく執筆方針

・ターゲットキーワード: ${row.keyword}
・月間検索ボリューム: ${fmtNum(row.volume)}
・競合難易度(KD): ${row.kd}
・推定CPC: ¥${fmtNum(Math.round(row.cpc * 150))}
・カテゴリ: ${row.detectedCategory}
・優先度: ${priorityLabels[row.priority] ?? ''}${trendNote}
${volumeStrategy}
${kdStrategy}${cpcStrategy}

■検索意図の整理（必ず踏まえる）

以下の複数の検索意図を統合して記事を設計すること：

・M&A・事業承継の基本的な仕組みを知りたい（基礎理解）
・自社の状況に合った方法の判断基準がほしい（意思決定）
・失敗したくない、騙されたくない、後悔したくない（リスク回避）${extraIntent}

■ターゲット

・事業承継・後継者問題を抱える中小企業オーナー・経営者
・会社売却や第三者承継を検討し始めたが、何から始めればよいか分からない層
・M&Aに漠然とした不安・疑問を持つ意思決定初期層

■必須条件

・M&A LOYALの実務知見・過去の支援事例の経験をベースに記述すること
・必要に応じて、実際の現場で使われた表現や意思決定の言葉を引用形式で入れること
・可能であれば、実務で使われた言葉や現場の意思決定を1〜2文引用すること
・机上の空論ではなく、「経営者が実際に直面している意思決定」をベースに記述すること
・M&A LOYALの強みである「オーナーに寄り添う伴走型支援」「地域密着・中小企業特化のM&A仲介」の内容をどこかに自然な形で入れること

■構成要件（SEO・LLMO最適化）

以下の構造で出力してください：

①タイトル（32文字以内・クリックされる設計）
②導入文（検索意図への共感＋記事の価値提示）
③結論要約（LLMO向けに先出しで要点整理）
④本文（見出し構造）
　- H2：本文の内容に合わせてください（「1. 」番号付き形式）
　- H2：本文の内容に合わせてください
　- H2：本文の内容に合わせてください
　- H3：各ポイントを具体的に解説（「1-1. 」形式）
⑤M&A LOYALならではの視点（独自性）
⑥まとめ
⑦CTA（無料相談・お問い合わせへの自然な導線）
⑧よくある質問（FAQ）— Q. と A. の形式で5つ程度

■品質要件

・専門性がありながらも読みやすい（法務・財務の専門家でない経営者でも理解できるレベル）
・抽象論ではなく、具体例・示唆を含める
・冗長表現は避け、簡潔かつ論理的に
・AIっぽさを排除（テンプレ感・不自然な言い回しNG）
・「近年〜」「M&Aが注目される中〜」「M&Aとは〜」から始まる定型導入は禁止

■SEO・LLMO要件

・ターゲットKW「${row.keyword}」を軸に、共起語・関連キーワードを自然に含める
・検索意図（情報収集・比較検討）を満たす
・箇条書き・構造化でAIが理解しやすい形式
・結論ファーストで要点を明確化

■出力形式

記事本文のみ出力してください。メタ情報（関連KW一覧・LLMO対策ポイント等）は出力不要です。`
}

export default function AhrefsPage() {
  const router = useRouter()
  const [datasets, setDatasets] = useState<AhrefsDataset[]>([])
  const [index, setIndex] = useState<DatasetMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const [activeTab, setActiveTab] = useState<TabKey>('opportunity')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedPriority, setSelectedPriority] = useState<'all' | PriorityLevel>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showCount, setShowCount] = useState(PAGE_SIZE)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/ahrefs')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'データの取得に失敗しました')
      setDatasets(json.datasets ?? [])
      setIndex(json.index ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'データの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleUpload = useCallback(async (fileList: FileList | null) => {
    if (!fileList?.length || uploading) return
    setUploading(true)
    setError(null)
    const file = fileList[0]
    const form = new FormData()
    form.append('file', file)
    try {
      const res = await fetch('/api/ahrefs', { method: 'POST', body: form })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'アップロードに失敗しました')
      await fetchData()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'アップロードに失敗しました')
    } finally {
      setUploading(false)
    }
  }, [uploading, fetchData])

  const handleDeleteDataset = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/ahrefs?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '削除に失敗しました')
      await fetchData()
    } catch (e) {
      setError(e instanceof Error ? e.message : '削除に失敗しました')
    }
  }, [fetchData])

  const handleWriteArticle = (row: ScoredKeyword) => {
    const params = new URLSearchParams({ kwTarget: row.keyword, kwPrompt: generateAutoPrompt(row) })
    router.push(`/editor?${params.toString()}`)
  }

  const allScored = useMemo(() => mergeAndAnalyze(datasets.map(d => d.keywords)), [datasets])
  const kwScored = useMemo(() => {
    const kwDs = datasets.filter(d => d.type === 'keywords')
    return kwDs.length > 0 ? mergeAndAnalyze(kwDs.map(d => d.keywords)) : []
  }, [datasets])
  const organicScored = useMemo(() => {
    const orgDs = datasets.filter(d => d.type === 'organic')
    return orgDs.length > 0 ? mergeAndAnalyze(orgDs.map(d => d.keywords)) : []
  }, [datasets])
  const allTrends = useMemo(() => detectTrends(datasets.flatMap(d => d.keywords)), [datasets])

  const activeData = useMemo(() => {
    switch (activeTab) {
      case 'opportunity': return kwScored
      case 'organic': return organicScored
      case 'all': return allScored
      default: return allScored
    }
  }, [activeTab, kwScored, organicScored, allScored])

  const categoryCounts = useMemo(() => getCategoryCounts(activeData), [activeData])

  const filtered = useMemo(() => {
    let list = activeData
    if (selectedPriority !== 'all') {
      list = list.filter(kw => kw.priority === selectedPriority)
    }
    if (selectedCategory !== 'all') {
      list = list.filter(kw => kw.detectedCategory === selectedCategory)
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      list = list.filter(kw => kw.keyword.toLowerCase().includes(q))
    }
    return list
  }, [activeData, selectedPriority, selectedCategory, searchQuery])

  const filteredTrends = useMemo(() => {
    let list = allTrends
    if (selectedCategory !== 'all') {
      list = list.filter(t => t.detectedCategory === selectedCategory)
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      list = list.filter(t => t.keyword.toLowerCase().includes(q))
    }
    return list
  }, [allTrends, selectedCategory, searchQuery])

  const visible = filtered.slice(0, showCount)
  const isOrganicTab = activeTab === 'organic'

  const activeTotal = activeData.length
  const p3Count = activeData.filter(k => k.priority === 3).length
  const p2Count = activeData.filter(k => k.priority === 2).length
  const trendCount = allTrends.length

  useEffect(() => { setShowCount(PAGE_SIZE); setSelectedPriority('all'); setSelectedCategory('all') }, [activeTab])
  useEffect(() => { setShowCount(PAGE_SIZE) }, [selectedPriority, selectedCategory, searchQuery])

  const hasData = datasets.length > 0

  return (
    <div
      className="w-full py-8"
      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files) }}
    >
      {dragOver && (
        <div className="fixed inset-0 bg-[#8B1A2A]/10 border-2 border-dashed border-[#8B1A2A] rounded-xl z-50 pointer-events-none flex items-center justify-center">
          <p className="text-[#8B1A2A] font-semibold text-lg">CSVをドロップしてインポート</p>
        </div>
      )}

      {/* Header row */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A2E] mb-1">KW分析ダッシュボード</h1>
          <p className="text-sm text-[#64748B]">
            AhrefsのCSVデータから狙い目キーワードを分析し、記事制作につなげます。
          </p>
        </div>
        <div className="relative flex-shrink-0">
          <input
            type="file"
            accept=".csv,.tsv"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            onChange={e => { handleUpload(e.target.files); e.target.value = '' }}
            disabled={uploading}
          />
          <button
            type="button"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 border-dashed border-[#E8D5D8] bg-white hover:border-[#8B1A2A] hover:bg-[#FDF5F6] transition-colors text-sm font-medium text-[#6B4C50] whitespace-nowrap"
          >
            <Upload size={16} className="text-[#94A3B8]" />
            {uploading ? 'アップロード中...' : 'CSVインポート'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800 flex items-start gap-2">
          <X size={16} className="flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Dataset badges */}
      {index.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {index.map(m => (
            <span
              key={m.id}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${
                m.type === 'organic'
                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                  : 'bg-blue-50 text-blue-700 border-blue-200'
              }`}
            >
              <span className="font-bold">{m.type === 'organic' ? '競合' : 'KW'}</span>
              <span className="truncate max-w-[200px]">{m.fileName.replace(/\.csv$/i, '')}</span>
              <span>{fmtNum(m.rowCount)}件</span>
              <span>{fmtDate(m.uploadedAt)}</span>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); handleDeleteDataset(m.id) }}
                className="ml-0.5 hover:text-red-600 transition-colors"
                title="削除"
              >
                <X size={14} />
              </button>
            </span>
          ))}
        </div>
      )}

      {loading && !hasData && (
        <div className="text-center py-16 text-[#64748B] text-sm">読み込み中...</div>
      )}

      {!loading && !hasData && (
        <div className="rounded-xl border border-[#E8D5D8] bg-white p-12 text-center">
          <Upload className="mx-auto text-[#C4A0A6] mb-3" size={48} />
          <p className="text-lg font-bold text-[#222222] mb-2">データがありません</p>
          <p className="text-sm text-[#808080]">
            AhrefsからエクスポートしたCSVをアップロードすると、KW分析ダッシュボードが表示されます。
          </p>
        </div>
      )}

      {hasData && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <SummaryCard label="KW総数" value={fmtNum(activeTotal)} />
            <SummaryCard label="★★★ 即攻め" value={fmtNum(p3Count)} accent="amber" />
            <SummaryCard label="★★ 有望" value={fmtNum(p2Count)} accent="blue" />
            <SummaryCard label="トレンドKW" value={fmtNum(trendCount)} accent="green" />
          </div>

          {/* Priority pills (hidden on trends tab) */}
          {activeTab !== 'trends' && (
            <div className="flex flex-wrap gap-2 mb-3">
              {([
                { key: 'all' as const, label: 'すべて', count: activeData.length },
                { key: 3 as PriorityLevel, label: '★★★ 即攻め', count: p3Count },
                { key: 2 as PriorityLevel, label: '★★ 有望', count: p2Count },
                { key: 1 as PriorityLevel, label: '★ 余力', count: activeData.filter(k => k.priority === 1).length },
                { key: 0 as PriorityLevel, label: '対象外', count: activeData.filter(k => k.priority === 0).length },
              ]).map(p => (
                <button
                  key={String(p.key)}
                  type="button"
                  onClick={() => setSelectedPriority(selectedPriority === p.key ? 'all' : p.key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                    selectedPriority === p.key
                      ? p.key === 3 ? 'bg-[#8B1A2A] text-white border-[#8B1A2A]'
                        : p.key === 2 ? 'bg-[#B5485A] text-white border-[#B5485A]'
                        : 'bg-[#8B1A2A] text-white border-[#8B1A2A]'
                      : 'bg-white text-[#6B4C50] border-[#E8D5D8] hover:border-[#8B1A2A]'
                  }`}
                >
                  {p.label} ({fmtNum(p.count)})
                </button>
              ))}
            </div>
          )}

          {/* Category pills */}
          <div className="flex flex-wrap gap-2 mb-5">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-[#8B1A2A] text-white border-[#8B1A2A]'
                  : 'bg-white text-[#6B4C50] border-[#E8D5D8] hover:border-[#8B1A2A]'
              }`}
            >
              すべて ({fmtNum(activeData.length)})
            </button>
            {categoryCounts.map(cc => (
              <button
                key={cc.category}
                type="button"
                onClick={() => setSelectedCategory(selectedCategory === cc.category ? 'all' : cc.category)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  selectedCategory === cc.category
                    ? 'bg-[#8B1A2A] text-white border-[#8B1A2A]'
                    : 'bg-white text-[#6B4C50] border-[#E8D5D8] hover:border-[#8B1A2A]'
                }`}
              >
                {cc.category} ({fmtNum(cc.count)})
              </button>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 mb-4 border-b border-[#E8D5D8]">
            {([
              { key: 'opportunity' as TabKey, label: '狙い目KW' },
              { key: 'organic' as TabKey, label: '競合KW' },
              { key: 'trends' as TabKey, label: 'トレンド' },
              { key: 'all' as TabKey, label: '全データ' },
            ]).map(tab => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2.5 text-sm font-semibold transition-colors relative ${
                  activeTab === tab.key
                    ? 'text-[#8B1A2A]'
                    : 'text-[#808080] hover:text-[#222222]'
                }`}
              >
                {tab.label}
                {activeTab === tab.key && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#8B1A2A] rounded-t" />
                )}
              </button>
            ))}
          </div>

          {/* Search bar (shared across all tabs) */}
          <div className="relative mb-4">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="キーワードを検索..."
              className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg border border-[#E8D5D8] bg-white focus:outline-none focus:ring-2 focus:ring-[#8B1A2A]/20"
            />
          </div>

          {/* Trends tab */}
          {activeTab === 'trends' ? (
            <TrendsTableView trends={filteredTrends} />
          ) : (
            <>

              {/* Table */}
              <div className="rounded-xl border border-[#E8D5D8] bg-white overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm table-fixed">
                    <thead>
                      <tr className="border-b border-[#E8D5D8] bg-[#FDF5F6]">
                        <th className="text-left py-3 px-4 font-semibold text-[#64748B]" style={{ width: isOrganicTab ? '20%' : '28%' }}>キーワード</th>
                        <th className="text-right py-3 px-4 font-semibold text-[#64748B]" style={{ width: isOrganicTab ? '9%' : '10%' }}>Volume</th>
                        <th className="text-center py-3 px-4 font-semibold text-[#64748B]" style={{ width: isOrganicTab ? '6%' : '7%' }}>KD</th>
                        <th className="text-right py-3 px-4 font-semibold text-[#64748B]" style={{ width: isOrganicTab ? '7%' : '8%' }}>CPC</th>
                        <th className="text-center py-3 px-4 font-semibold text-[#64748B]" style={{ width: isOrganicTab ? '8%' : '9%' }}>優先度</th>
                        <th className="text-center py-3 px-4 font-semibold text-[#64748B]" style={{ width: isOrganicTab ? '7%' : '8%' }}>スコア</th>
                        {isOrganicTab && (
                          <>
                            <th className="text-center py-3 px-4 font-semibold text-[#64748B]" style={{ width: '6%' }}>順位</th>
                            <th className="text-right py-3 px-4 font-semibold text-[#64748B]" style={{ width: '9%' }}>流入変動</th>
                          </>
                        )}
                        <th className="text-center py-3 px-4 font-semibold text-[#64748B]" style={{ width: isOrganicTab ? '10%' : '13%' }}>カテゴリ</th>
                        <th className="text-center py-3 px-4 font-semibold text-[#64748B]" style={{ width: isOrganicTab ? '10%' : '11%' }}>アクション</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((kw, i) => (
                        <tr
                          key={`${kw.keyword}-${i}`}
                          className="border-b border-[#E8D5D8] hover:bg-[#FDF5F6]/60 transition-colors"
                        >
                          <td className="py-3 px-4">
                            <div className="font-semibold text-[#1A1A2E] truncate">{kw.keyword}</div>
                            {kw.url && (
                              <a
                                href={kw.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] text-[#8B1A2A] hover:underline truncate block"
                              >
                                {kw.url.replace(/^https?:\/\//, '').slice(0, 50)}
                              </a>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-medium text-[#1A1A2E]">
                            {fmtNum(kw.volume)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className="inline-block px-2 py-0.5 rounded text-xs font-bold"
                              style={{ color: kdColor(kw.kd), backgroundColor: kdBg(kw.kd) }}
                            >
                              {kw.kd}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right text-[#64748B]">
                            {kw.cpc > 0 ? `¥${fmtNum(Math.round(kw.cpc * 150))}` : '-'}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <PriorityBadge level={kw.priority} />
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="text-sm font-bold" style={{ color: '#8B1A2A' }}>
                              {kw.opportunityScore}
                            </span>
                          </td>
                          {isOrganicTab && (
                            <>
                              <td className="py-3 px-4 text-center text-[#64748B]">
                                {kw.position != null ? kw.position : '-'}
                              </td>
                              <td className="py-3 px-4 text-right">
                                {kw.trafficChange != null ? (
                                  <span className={kw.trafficChange > 0 ? 'text-green-600 font-semibold' : kw.trafficChange < 0 ? 'text-red-600 font-semibold' : 'text-[#64748B]'}>
                                    {kw.trafficChange > 0 ? '+' : ''}{fmtNum(kw.trafficChange)}
                                  </span>
                                ) : '-'}
                              </td>
                            </>
                          )}
                          <td className="py-3 px-4 text-center">
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-[#F1F5F9] text-[#475569]">
                              {kw.detectedCategory}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => handleWriteArticle(kw)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold text-white transition-colors whitespace-nowrap"
                              style={{ backgroundColor: kw.priority === 3 ? '#8B1A2A' : '#B5485A' }}
                              onMouseEnter={e => (e.currentTarget.style.backgroundColor = kw.priority === 3 ? '#6E1221' : '#943848')}
                              onMouseLeave={e => (e.currentTarget.style.backgroundColor = kw.priority === 3 ? '#8B1A2A' : '#B5485A')}
                            >
                              <Sparkles size={12} />
                              記事作成
                            </button>
                          </td>
                        </tr>
                      ))}
                      {visible.length === 0 && (
                        <tr>
                          <td colSpan={isOrganicTab ? 10 : 8} className="py-12 text-center text-[#94A3B8] text-sm">
                            {activeTab === 'opportunity' && kwScored.length === 0
                              ? 'Keywords ExplorerのCSVをアップロードしてください'
                              : activeTab === 'organic' && organicScored.length === 0
                                ? 'Organic KeywordsのCSVをアップロードしてください'
                                : '条件に一致するキーワードがありません'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {filtered.length > showCount && (
                <div className="flex justify-center mt-4">
                  <button
                    type="button"
                    onClick={() => setShowCount(prev => prev + PAGE_SIZE)}
                    className="px-6 py-2 rounded-lg text-sm font-medium text-[#8B1A2A] border border-[#8B1A2A] hover:bg-[#8B1A2A]/5 transition-colors"
                  >
                    さらに{Math.min(PAGE_SIZE, filtered.length - showCount)}件表示
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

function SummaryCard({ label, value, accent }: { label: string; value: string; accent?: 'green' | 'blue' | 'purple' | 'amber' }) {
  const styles = {
    green: 'bg-[#F5F0E8] border-[#D5C9B8] text-[#7A6B52]',
    blue: 'bg-[#FDF5F6] border-[#E8D5D8] text-[#B5485A]',
    purple: 'bg-[#FDF5F6] border-[#E8D5D8] text-[#8B1A2A]',
    amber: 'bg-[#FDF5F6] border-[#C4A0A6] text-[#8B1A2A]',
  }
  const s = accent ? styles[accent] : 'bg-white border-[#E8D5D8] text-[#222222]'
  const [bgBorder, textColor] = [s.split(' ').slice(0, 2).join(' '), s.split(' ').slice(2).join(' ')]
  return (
    <div className={`rounded-xl border p-4 ${bgBorder}`}>
      <div className="text-[10px] font-semibold text-[#808080] uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-2xl font-bold ${textColor}`}>{value}</div>
    </div>
  )
}

function PriorityBadge({ level }: { level: PriorityLevel }) {
  if (level === 3) return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-[#FDF5F6] text-[#8B1A2A] border border-[#C4A0A6]">
      ★★★
    </span>
  )
  if (level === 2) return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-[#FDF5F6] text-[#B5485A] border border-[#E8D5D8]">
      ★★
    </span>
  )
  if (level === 1) return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#FAF8F5] text-[#808080] border border-[#E8E0D5]">
      ★
    </span>
  )
  return <span className="text-xs text-[#C4A0A6]">−</span>
}

function TrendsTableView({ trends }: { trends: TrendKeyword[] }) {
  if (trends.length === 0) {
    return (
      <div className="rounded-xl border border-[#E8D5D8] bg-white p-12 text-center text-sm text-[#C4A0A6]">
        トレンドデータがありません。SV trendデータを含むCSVをアップロードしてください。
      </div>
    )
  }
  return (
    <div className="rounded-xl border border-[#E8D5D8] bg-white overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm table-fixed">
          <thead>
            <tr className="border-b border-[#E8D5D8] bg-[#FDF5F6]">
              <th className="text-left py-3 px-4 font-semibold text-[#64748B]" style={{ width: '35%' }}>キーワード</th>
              <th className="text-right py-3 px-4 font-semibold text-[#64748B]" style={{ width: '15%' }}>前回Vol</th>
              <th className="text-right py-3 px-4 font-semibold text-[#64748B]" style={{ width: '15%' }}>今回Vol</th>
              <th className="text-right py-3 px-4 font-semibold text-[#64748B]" style={{ width: '15%' }}>変化率</th>
              <th className="text-center py-3 px-4 font-semibold text-[#64748B]" style={{ width: '10%' }}>状態</th>
            </tr>
          </thead>
          <tbody>
            {trends.map((t, i) => (
              <tr key={`${t.keyword}-${i}`} className="border-b border-[#E8D5D8] hover:bg-[#FDF5F6]/60 transition-colors">
                <td className="py-3 px-4">
                  <span className="font-semibold text-[#1A1A2E]">{t.keyword}</span>
                </td>
                <td className="py-3 px-4 text-right text-[#64748B]">
                  {fmtNum(t.previousVolume)}
                </td>
                <td className="py-3 px-4 text-right font-medium text-[#1A1A2E]">
                  {fmtNum(t.volume)}
                </td>
                <td className="py-3 px-4 text-right">
                  <span className={t.changePercent > 0 ? 'text-green-600 font-semibold' : t.changePercent < 0 ? 'text-red-600 font-semibold' : 'text-[#64748B]'}>
                    {t.changePercent > 0 ? '+' : ''}{t.changePercent}%
                  </span>
                </td>
                <td className="py-3 px-4 text-center">
                  {t.isNew ? (
                    <span className="inline-block px-2.5 py-0.5 rounded text-[10px] font-bold bg-[#F1F5F9] text-[#64748B] border border-[#D0E3F0]">
                      NEW
                    </span>
                  ) : t.trend === 'up' ? (
                    <TrendingUp size={16} className="inline text-green-600" />
                  ) : (
                    <TrendingDown size={16} className="inline text-red-500" />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
