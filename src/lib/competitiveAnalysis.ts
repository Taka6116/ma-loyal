import { fetchApiUsage, fetchOrganicKeywords } from '@/lib/ahrefsApi'
import { getS3ObjectAsText, putS3Object } from '@/lib/s3Reference'

const CONFIG_KEY = 'competitive-analysis/config.json'
const RESULTS_KEY = 'competitive-analysis/results.json'
const HISTORY_KEY = 'competitive-analysis/history.json'
const MAX_HISTORY = 15

export interface CompetitorConfig {
  id: string
  name: string
  domain: string
  type: 'direct' | 'indirect'
  note: string
  urls: { url: string; label: string }[]
}

export interface SourceFact {
  text: string
  sourceUrl: string
  confirmedAt: string
}

export interface CompetitorAxes {
  message: SourceFact[]
  pricing: SourceFact[]
  offering: SourceFact[]
  positioning: SourceFact[]
  authority: SourceFact[]
}

export interface CompetitorKeyword {
  keyword: string
  volume: number
  position: number | null
  traffic: number | null
  url: string
}

export interface CompetitorResult {
  competitorId: string
  updatedAt: string
  axes?: CompetitorAxes
  keywords?: CompetitorKeyword[]
  keywordUpdatedAt?: string
  error?: string
}

export interface KeywordOpportunity {
  keyword: string
  volume: number
  competitors: { name: string; position: number | null; url: string }[]
  selfPosition: number | null
  opportunity: 'gap' | 'weak'
}

export interface StrategyAction {
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  phase: 'awareness' | 'research' | 'comparison' | 'decision'
  category: 'コンテンツ' | 'SEO' | 'CV導線'
  target: string
  kpi: string
}

export interface StrategyReport {
  generatedAt: string
  summary: string
  observedFacts: string[]
  opportunities: string[]
  positioning: {
    xAxis: string
    yAxis: string
    points: { name: string; x: number; y: number; rationale: string; isSelf?: boolean }[]
    whitespace: string
  }
  funnelCoverage: {
    phase: 'awareness' | 'research' | 'comparison' | 'decision'
    self: string
    competitor: string
    implication: string
  }[]
  actions: StrategyAction[]
  caveats: string[]
}

export interface CompetitiveDocument {
  updatedAt: string
  competitors: Record<string, CompetitorResult>
  selfKeywords: CompetitorKeyword[]
  selfKeywordUpdatedAt?: string
  report?: StrategyReport
}

export const DEFAULT_COMPETITORS: CompetitorConfig[] = [
  { id: 'batonz', name: 'BATONZ（バトンズ）', domain: 'batonz.jp', type: 'direct', note: '中小企業・小規模事業者向けM&Aプラットフォーム。', urls: [{ url: 'https://batonz.jp/', label: 'トップページ' }] },
  { id: 'tranbi', name: 'TRANBI（トランビ）', domain: 'tranbi.com', type: 'direct', note: '売り手と買い手の直接マッチング型M&Aプラットフォーム。', urls: [{ url: 'https://www.tranbi.com/', label: 'トップページ' }] },
  { id: 'ma-succeed', name: 'M&Aサクシード', domain: 'ma-succeed.jp', type: 'direct', note: '法人限定・審査制のM&Aプラットフォーム。', urls: [{ url: 'https://ma-succeed.jp/', label: 'トップページ' }] },
  { id: 'ma-cloud', name: 'M&Aクラウド', domain: 'macloud.jp', type: 'direct', note: '買い手企業の買収ニーズ公開を特徴とするM&Aサービス。', urls: [{ url: 'https://macloud.jp/', label: 'トップページ' }] },
  { id: 'fundbook', name: 'fundbook（ファンドブック）', domain: 'fundbook.co.jp', type: 'direct', note: 'M&A仲介とプラットフォームを組み合わせたサービス。', urls: [{ url: 'https://fundbook.co.jp/', label: 'トップページ' }] },
  { id: 'ma-soken', name: 'M&A総研', domain: 'masouken.com', type: 'direct', note: '成約スピードと実績を訴求するM&A仲介サービス。', urls: [{ url: 'https://masouken.com/', label: 'トップページ' }] },
]

export async function loadCompetitorConfig(): Promise<CompetitorConfig[]> {
  const object = await getS3ObjectAsText(CONFIG_KEY)
  if (!object) return DEFAULT_COMPETITORS
  try {
    const config = JSON.parse(object.content) as Array<CompetitorConfig & { url?: string }>
    if (!Array.isArray(config) || config.length === 0) return DEFAULT_COMPETITORS
    return config.map(item => ({
      ...item,
      urls: item.urls?.length ? item.urls : item.url ? [{ url: item.url, label: 'トップページ' }] : [],
    }))
  } catch {
    return DEFAULT_COMPETITORS
  }
}

export async function saveCompetitorConfig(config: CompetitorConfig[]) {
  if (!config.every(item => item.name && item.domain && item.urls.length > 0 && item.urls.every(page => isAllowedUrl(page.url, item.domain)))) {
    throw new Error('競合URLは登録ドメイン配下のHTTPS URLを指定してください')
  }
  if (!await putS3Object(CONFIG_KEY, JSON.stringify(config, null, 2))) throw new Error('競合設定のS3保存に失敗しました')
}

export async function loadCompetitiveDocument(): Promise<CompetitiveDocument> {
  const object = await getS3ObjectAsText(RESULTS_KEY)
  if (!object) return { updatedAt: '', competitors: {}, selfKeywords: [] }
  try {
    const document = JSON.parse(object.content) as Partial<CompetitiveDocument>
    return {
      updatedAt: document.updatedAt ?? '',
      competitors: document.competitors ?? {},
      selfKeywords: document.selfKeywords ?? [],
      selfKeywordUpdatedAt: document.selfKeywordUpdatedAt,
      report: document.report,
    }
  } catch {
    return { updatedAt: '', competitors: {}, selfKeywords: [] }
  }
}

async function saveDocument(document: CompetitiveDocument) {
  if (!await putS3Object(RESULTS_KEY, JSON.stringify(document, null, 2))) throw new Error('競合分析結果のS3保存に失敗しました')
}

export interface CompetitiveSnapshot {
  date: string
  savedAt: string
  document: CompetitiveDocument
}

export async function loadCompetitiveHistory(): Promise<CompetitiveSnapshot[]> {
  const object = await getS3ObjectAsText(HISTORY_KEY)
  if (!object) return []
  try {
    const history = JSON.parse(object.content)
    return Array.isArray(history) ? history as CompetitiveSnapshot[] : []
  } catch {
    return []
  }
}

async function snapshotDocument(document: CompetitiveDocument) {
  const date = new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10)
  const history = await loadCompetitiveHistory()
  const next = [{ date, savedAt: new Date().toISOString(), document }, ...history.filter(item => item.date !== date)]
    .slice(0, MAX_HISTORY)
  await putS3Object(HISTORY_KEY, JSON.stringify(next))
}

function isAllowedUrl(raw: string, domain: string): boolean {
  try {
    const url = new URL(raw)
    return url.protocol === 'https:' && (url.hostname === domain || url.hostname.endsWith(`.${domain}`))
  } catch {
    return false
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

function tagText(html: string, selector: RegExp): string[] {
  return [...html.matchAll(selector)].map(match => stripHtml(match[1])).filter(Boolean).slice(0, 8)
}

function facts(items: string[], sourceUrl: string, now: string): SourceFact[] {
  return items.filter(Boolean).slice(0, 5).map(text => ({ text: text.slice(0, 220), sourceUrl, confirmedAt: now }))
}

/** 公式ページの一次情報を取得し、AI推測を使わず5軸へ整理する。 */
export async function analyzeCompetitor(competitorId: string): Promise<CompetitorResult> {
  const config = await loadCompetitorConfig()
  const competitor = config.find(item => item.id === competitorId)
  if (!competitor) throw new Error('指定された競合が見つかりません')

  const now = new Date().toISOString()
  const collected = await Promise.all(competitor.urls.map(async page => {
    if (!isAllowedUrl(page.url, competitor.domain)) throw new Error('競合URLが不正です')
    const response = await fetch(page.url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MALoyalCompetitiveResearch/1.0)', Accept: 'text/html' },
      cache: 'no-store',
    })
    const html = await response.text()
    if (!response.ok) throw new Error(`${page.label}の取得に失敗しました（${response.status}）`)
    const title = tagText(html, /<title[^>]*>([\s\S]*?)<\/title>/gi)
    const descriptions = [
      ...html.matchAll(/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']*)["'][^>]*>/gi),
      ...html.matchAll(/<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["'](?:description|og:description)["'][^>]*>/gi),
    ].map(match => match[1])
    return {
      url: page.url,
      title,
      descriptions,
      headings: tagText(html, /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi),
      text: stripHtml(html),
    }
  }))
  const title = collected.flatMap(page => page.title)
  const description = collected.flatMap(page => page.descriptions)
  const headings = collected.flatMap(page => page.headings)
  const pricing = collected.flatMap(page => page.text.match(/[^。]{0,80}(?:料金|費用|手数料|成功報酬|無料)[^。]{0,120}。?/g) ?? [])
  const authority = collected.flatMap(page => page.text.match(/[^。]{0,80}(?:実績|成約|案件|専門家|アドバイザー)[^。]{0,120}。?/g) ?? [])
  const sourceUrl = collected[0]?.url ?? competitor.urls[0].url
  const axes: CompetitorAxes = {
    message: facts([...title, ...description], sourceUrl, now),
    pricing: facts(pricing, sourceUrl, now),
    offering: facts(headings, sourceUrl, now),
    positioning: facts([...description, ...headings.slice(0, 2)], sourceUrl, now),
    authority: facts(authority, sourceUrl, now),
  }
  const document = await loadCompetitiveDocument()
  const previous = document.competitors[competitorId]
  const result: CompetitorResult = { competitorId, updatedAt: now, axes, keywords: previous?.keywords, keywordUpdatedAt: previous?.keywordUpdatedAt }
  document.competitors[competitorId] = result
  document.updatedAt = now
  await saveDocument(document)
  return result
}

function toKeywords(rows: Awaited<ReturnType<typeof fetchOrganicKeywords>>): CompetitorKeyword[] {
  return rows.map(row => ({ keyword: row.keyword, volume: row.volume, position: row.position, traffic: row.currentTraffic, url: row.url }))
}

export async function refreshCompetitorKeywords(competitorId: string): Promise<CompetitorResult> {
  const config = await loadCompetitorConfig()
  const competitor = config.find(item => item.id === competitorId)
  if (!competitor) throw new Error('指定された競合が見つかりません')
  const now = new Date().toISOString()
  const document = await loadCompetitiveDocument()
  const keywords = await fetchOrganicKeywords({ target: competitor.domain, limit: 500 })
  if (keywords.length === 0) throw new Error(`${competitor.name}のキーワードが取得できませんでした`)

  if (document.selfKeywords.length === 0) {
    try {
      const ownRows = await fetchOrganicKeywords({ limit: 500 })
      document.selfKeywords = toKeywords(ownRows)
      document.selfKeywordUpdatedAt = now
    } catch (error) {
      console.warn('[CompetitiveAnalysis] 自社KWの取得に失敗しました:', error)
    }
  }
  const previous = document.competitors[competitorId]
  const result: CompetitorResult = {
    competitorId,
    updatedAt: now,
    axes: previous?.axes,
    keywords: toKeywords(keywords),
    keywordUpdatedAt: now,
  }
  document.competitors[competitorId] = result
  document.updatedAt = now
  await saveDocument(document)
  return result
}

function normalized(keyword: string): string {
  return keyword.toLocaleLowerCase('ja-JP').replace(/[\s　・、。，,]/g, '')
}

export function buildKeywordOpportunities(config: CompetitorConfig[], document: CompetitiveDocument): KeywordOpportunity[] {
  const self = new Map(document.selfKeywords.map(keyword => [normalized(keyword.keyword), keyword]))
  const opportunities = new Map<string, KeywordOpportunity>()
  for (const competitor of config) {
    for (const keyword of document.competitors[competitor.id]?.keywords ?? []) {
      if (keyword.position !== null && keyword.position > 30) continue
      if (keyword.volume < 20) continue
      const key = normalized(keyword.keyword)
      const own = self.get(key)
      const opportunity = !own ? 'gap' : (own.position ?? 999) > 20 ? 'weak' : null
      if (!opportunity) continue
      const current = opportunities.get(key) ?? { keyword: keyword.keyword, volume: keyword.volume, competitors: [], selfPosition: own?.position ?? null, opportunity }
      current.volume = Math.max(current.volume, keyword.volume)
      current.competitors.push({ name: competitor.name, position: keyword.position, url: keyword.url })
      if (opportunity === 'gap') current.opportunity = 'gap'
      opportunities.set(key, current)
    }
  }
  return [...opportunities.values()].sort((a, b) => b.volume - a.volume || b.competitors.length - a.competitors.length).slice(0, 50)
}

export async function generateStrategy(): Promise<StrategyReport> {
  const [config, document] = await Promise.all([loadCompetitorConfig(), loadCompetitiveDocument()])
  const opportunities = buildKeywordOpportunities(config, document)
  const actions: StrategyAction[] = opportunities.slice(0, 4).map((item, index) => ({
    title: `${item.keyword}の${item.opportunity === 'gap' ? '新規' : 'リライト'}記事を作成`,
    description: `${item.competitors.map(competitor => competitor.name).join('・')}が上位表示するKWです。M&Aロイヤルの完全成功報酬・オーナー伴走の実務視点で差別化します。`,
    priority: index < 2 ? 'high' : 'medium',
    phase: index === 0 ? 'comparison' : 'research',
    category: 'コンテンツ',
    target: item.keyword,
    kpi: '検索順位・自然検索流入・相談CV',
  }))
  if (actions.length === 0) {
    actions.push({ title: '競合KWを取得する', description: '競合一覧からAhrefsデータを同期すると、M&Aロイヤル向けの具体的な施策候補を生成します。', priority: 'high', phase: 'research', category: 'SEO', target: '競合Organic Keywords', kpi: '同期済み競合数' })
  }
  const analyzed = config.filter(item => document.competitors[item.id]?.axes)
  const observedFacts = analyzed.slice(0, 4).map(item => {
    const axes = document.competitors[item.id].axes
    return `${item.name}: ${axes?.positioning[0]?.text ?? axes?.message[0]?.text ?? '公式サイトを分析済み'}`
  })
  const report: StrategyReport = {
    generatedAt: new Date().toISOString(),
    summary: `M&Aロイヤルは、完全成功報酬とオーナーに寄り添う伴走支援を明確に打ち出し、競合が検索上位を獲得している比較・検討キーワードを優先的に補完します。まず${opportunities[0]?.keyword ?? '競合キーワード'}を起点に、相談前の不安を解消する実務コンテンツと問い合わせ導線を強化します。`,
    observedFacts,
    opportunities: opportunities.slice(0, 4).map(item => `${item.keyword}（Vol.${item.volume.toLocaleString()}）は${item.opportunity === 'gap' ? '自社未露出' : '自社順位が弱い'}ため、獲得余地があります。`),
    positioning: {
      xAxis: 'オンライン完結度',
      yAxis: 'アドバイザー伴走度',
      points: [
        { name: 'M&Aロイヤル', x: 42, y: 88, rationale: '完全成功報酬とオーナー伴走型の支援', isSelf: true },
        ...config.slice(0, 5).map((item, index) => ({
          name: item.name.replace(/（.*?）/g, ''),
          x: 72 - index * 7,
          y: 40 + index * 6,
          rationale: item.note,
        })),
      ],
      whitespace: '費用リスクを抑えながら、経営者の意思決定に深く伴走する領域',
    },
    funnelCoverage: [
      { phase: 'awareness', self: '事業承継・会社売却の基礎情報', competitor: '大規模な一般KWコンテンツ', implication: '経営者の初期不安に答える記事を拡充' },
      { phase: 'research', self: '実務視点と支援方針', competitor: '手続き・相場の網羅記事', implication: '具体的な判断基準と事例を追加' },
      { phase: 'comparison', self: '完全成功報酬・伴走支援', competitor: '実績・スピード・案件数', implication: '料金と支援品質の比較ページを強化' },
      { phase: 'decision', self: '無料相談と個別提案', competitor: '査定・登録フォーム', implication: '相談後の流れと安心材料を可視化' },
    ],
    actions,
    caveats: ['公式サイトの表示内容とAhrefs取得時点のデータに基づく分析です。', '順位・検索ボリュームは定期同期により更新してください。'],
  }
  document.report = report
  document.updatedAt = report.generatedAt
  await saveDocument(document)
  await snapshotDocument(document)
  return report
}

export { fetchApiUsage }
