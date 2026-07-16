import { fetchApiUsage, fetchOrganicKeywords } from '@/lib/ahrefsApi'
import { getS3ObjectAsText, putS3Object } from '@/lib/s3Reference'

const CONFIG_KEY = 'competitive-analysis/config.json'
const RESULTS_KEY = 'competitive-analysis/results.json'

export interface CompetitorConfig {
  id: string
  name: string
  domain: string
  type: 'direct' | 'indirect'
  note: string
  url: string
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
  priority: 'high' | 'medium'
  category: 'コンテンツ' | 'SEO' | 'CV導線'
  target: string
  kpi: string
}

export interface CompetitiveDocument {
  updatedAt: string
  competitors: Record<string, CompetitorResult>
  selfKeywords: CompetitorKeyword[]
  selfKeywordUpdatedAt?: string
  actions?: StrategyAction[]
}

export const DEFAULT_COMPETITORS: CompetitorConfig[] = [
  { id: 'batonz', name: 'BATONZ（バトンズ）', domain: 'batonz.jp', type: 'direct', note: '中小企業・小規模事業者向けM&Aプラットフォーム。', url: 'https://batonz.jp/' },
  { id: 'tranbi', name: 'TRANBI（トランビ）', domain: 'tranbi.com', type: 'direct', note: '売り手と買い手の直接マッチング型M&Aプラットフォーム。', url: 'https://www.tranbi.com/' },
  { id: 'ma-succeed', name: 'M&Aサクシード', domain: 'ma-succeed.jp', type: 'direct', note: '法人限定・審査制のM&Aプラットフォーム。', url: 'https://ma-succeed.jp/' },
  { id: 'ma-cloud', name: 'M&Aクラウド', domain: 'macloud.jp', type: 'direct', note: '買い手企業の買収ニーズ公開を特徴とするM&Aサービス。', url: 'https://macloud.jp/' },
  { id: 'fundbook', name: 'fundbook（ファンドブック）', domain: 'fundbook.co.jp', type: 'direct', note: 'M&A仲介とプラットフォームを組み合わせたサービス。', url: 'https://fundbook.co.jp/' },
  { id: 'ma-soken', name: 'M&A総研', domain: 'masouken.com', type: 'direct', note: '成約スピードと実績を訴求するM&A仲介サービス。', url: 'https://masouken.com/' },
]

export async function loadCompetitorConfig(): Promise<CompetitorConfig[]> {
  const object = await getS3ObjectAsText(CONFIG_KEY)
  if (!object) return DEFAULT_COMPETITORS
  try {
    const config = JSON.parse(object.content)
    return Array.isArray(config) && config.length > 0 ? config as CompetitorConfig[] : DEFAULT_COMPETITORS
  } catch {
    return DEFAULT_COMPETITORS
  }
}

export async function saveCompetitorConfig(config: CompetitorConfig[]) {
  if (!config.every(item => item.name && item.domain && isAllowedUrl(item.url, item.domain))) {
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
      actions: document.actions ?? [],
    }
  } catch {
    return { updatedAt: '', competitors: {}, selfKeywords: [] }
  }
}

async function saveDocument(document: CompetitiveDocument) {
  if (!await putS3Object(RESULTS_KEY, JSON.stringify(document, null, 2))) throw new Error('競合分析結果のS3保存に失敗しました')
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
  if (!isAllowedUrl(competitor.url, competitor.domain)) throw new Error('競合URLが不正です')

  const response = await fetch(competitor.url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MALoyalCompetitiveResearch/1.0)', Accept: 'text/html' },
    cache: 'no-store',
  })
  const html = await response.text()
  if (!response.ok) throw new Error(`公式ページの取得に失敗しました（${response.status}）`)

  const now = new Date().toISOString()
  const title = tagText(html, /<title[^>]*>([\s\S]*?)<\/title>/gi)
  const description = [...html.matchAll(/<meta[^>]+(?:name|property)=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/gi)].map(match => match[1])
  const headings = tagText(html, /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)
  const text = stripHtml(html)
  const pricing = text.match(/[^。]{0,80}(?:料金|費用|手数料|成功報酬|無料)[^。]{0,120}。?/g) ?? []
  const authority = text.match(/[^。]{0,80}(?:実績|成約|案件|専門家|アドバイザー)[^。]{0,120}。?/g) ?? []
  const axes: CompetitorAxes = {
    message: facts([...title, ...description], competitor.url, now),
    pricing: facts(pricing, competitor.url, now),
    offering: facts(headings, competitor.url, now),
    positioning: facts([...description, ...headings.slice(0, 2)], competitor.url, now),
    authority: facts(authority, competitor.url, now),
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
  const [keywords, ownRows] = await Promise.all([
    fetchOrganicKeywords({ target: competitor.domain, limit: 500 }),
    fetchOrganicKeywords({ limit: 500 }),
  ])
  const document = await loadCompetitiveDocument()
  const previous = document.competitors[competitorId]
  const result: CompetitorResult = {
    competitorId,
    updatedAt: now,
    axes: previous?.axes,
    keywords: toKeywords(keywords),
    keywordUpdatedAt: now,
  }
  document.competitors[competitorId] = result
  document.selfKeywords = toKeywords(ownRows)
  document.selfKeywordUpdatedAt = now
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
      if ((keyword.position ?? 999) > 30 || keyword.volume < 20) continue
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

export async function generateStrategy(): Promise<StrategyAction[]> {
  const [config, document] = await Promise.all([loadCompetitorConfig(), loadCompetitiveDocument()])
  const opportunities = buildKeywordOpportunities(config, document)
  const actions: StrategyAction[] = opportunities.slice(0, 4).map((item, index) => ({
    title: `${item.keyword}の${item.opportunity === 'gap' ? '新規' : 'リライト'}記事を作成`,
    description: `${item.competitors.map(competitor => competitor.name).join('・')}が上位表示するKWです。M&Aロイヤルの完全成功報酬・オーナー伴走の実務視点で差別化します。`,
    priority: index < 2 ? 'high' : 'medium',
    category: 'コンテンツ',
    target: item.keyword,
    kpi: '検索順位・自然検索流入・相談CV',
  }))
  if (actions.length === 0) {
    actions.push({ title: '競合KWを取得する', description: '競合一覧からAhrefsデータを同期すると、M&Aロイヤル向けの具体的な施策候補を生成します。', priority: 'high', category: 'SEO', target: '競合Organic Keywords', kpi: '同期済み競合数' })
  }
  document.actions = actions
  document.updatedAt = new Date().toISOString()
  await saveDocument(document)
  return actions
}

export { fetchApiUsage }
