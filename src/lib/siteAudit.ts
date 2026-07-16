import { getS3ObjectAsText, putS3Object } from '@/lib/s3Reference'

const RESULTS_KEY = 'site-audit/results.json'
const HISTORY_KEY = 'site-audit/history.json'
const ALLOWED_HOSTS = ['ma-la.co.jp']

export type AuditPhase = 'entrance' | 'awareness' | 'research' | 'comparison' | 'conversion' | 'other'
export type AuditPriority = 'high' | 'medium' | 'low'

export const DEFAULT_AUDIT_PAGES: { url: string; label: string; phase: AuditPhase }[] = [
  { url: 'https://ma-la.co.jp/', label: 'トップページ', phase: 'entrance' },
  { url: 'https://ma-la.co.jp/m-and-a/', label: 'M&A記事・サービス', phase: 'awareness' },
  { url: 'https://ma-la.co.jp/m-and-a/all-articles/', label: 'M&A記事一覧', phase: 'awareness' },
  { url: 'https://ma-la.co.jp/result/', label: '成約実績', phase: 'comparison' },
  { url: 'https://ma-la.co.jp/download/', label: '資料ダウンロード', phase: 'research' },
  { url: 'https://ma-la.co.jp/inquiry/', label: 'お問い合わせ', phase: 'conversion' },
]

export interface PageTechAudit {
  httpStatus: number
  title: string
  titleLength: number
  metaDescription: string
  metaDescriptionLength: number
  h1Texts: string[]
  h2Count: number
  h3Count: number
  textLength: number
  imagesTotal: number
  imagesMissingAlt: number
  internalLinks: number
  externalLinks: number
  canonicalUrl: string
  hasOgp: boolean
  structuredDataTypes: string[]
  isNoindex: boolean
}

export interface PageAuditAi {
  score: number
  summary: string
  issues: string[]
  actions: { title: string; description: string; priority: AuditPriority }[]
}

export interface PageAuditResult {
  url: string
  label: string
  phase: AuditPhase
  generatedAt: string
  tech: PageTechAudit
  ai: PageAuditAi
}

export interface SiteAuditOverall {
  generatedAt: string
  summary: string
  issues: string[]
  actions: { title: string; description: string; priority: AuditPriority; category: string }[]
}

export interface SiteAuditDocument {
  updatedAt: string
  pages: Record<string, PageAuditResult>
  overall?: SiteAuditOverall
}

export interface SiteAuditSnapshot {
  date: string
  savedAt: string
  pages: Record<string, PageAuditResult>
  overall?: SiteAuditOverall
}

export function isAllowedAuditUrl(raw: string): boolean {
  try {
    const url = new URL(raw)
    return url.protocol === 'https:' && ALLOWED_HOSTS.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`))
  } catch {
    return false
  }
}

function phaseForUrl(url: string): AuditPhase {
  return DEFAULT_AUDIT_PAGES.find(page => page.url.replace(/\/$/, '') === url.replace(/\/$/, ''))?.phase ?? 'other'
}

export async function loadSiteAuditDocument(): Promise<SiteAuditDocument> {
  const object = await getS3ObjectAsText(RESULTS_KEY)
  if (!object) return { updatedAt: '', pages: {} }
  try {
    const parsed = JSON.parse(object.content) as SiteAuditDocument
    return { updatedAt: parsed.updatedAt ?? '', pages: parsed.pages ?? {}, overall: parsed.overall }
  } catch {
    return { updatedAt: '', pages: {} }
  }
}

export async function loadSiteAuditHistory(): Promise<SiteAuditSnapshot[]> {
  const object = await getS3ObjectAsText(HISTORY_KEY)
  if (!object) return []
  try {
    const parsed = JSON.parse(object.content)
    return Array.isArray(parsed) ? parsed as SiteAuditSnapshot[] : []
  } catch {
    return []
  }
}

async function saveDocument(document: SiteAuditDocument) {
  if (!await putS3Object(RESULTS_KEY, JSON.stringify(document, null, 2))) throw new Error('診断結果のS3保存に失敗しました')
}

function text(html: string) {
  return html.replace(/<script\b[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
}

function attribute(tag: string, name: string) {
  return tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, 'i'))?.[1] ?? ''
}

function meta(html: string, key: string) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    if ((attribute(tag, 'name') || attribute(tag, 'property')).toLowerCase() === key.toLowerCase()) return attribute(tag, 'content')
  }
  return ''
}

function headings(html: string, level: number) {
  return [...html.matchAll(new RegExp(`<h${level}\\b[^>]*>([\\s\\S]*?)<\\/h${level}>`, 'gi'))].map(match => text(match[1])).filter(Boolean)
}

function parseHtml(html: string, pageUrl: string, httpStatus: number): PageTechAudit {
  const body = html.replace(/<script\b[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
  const title = text(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '')
  const h1Texts = headings(body, 1)
  const imgTags = html.match(/<img\b[^>]*>/gi) ?? []
  const host = new URL(pageUrl).hostname
  let internalLinks = 0
  let externalLinks = 0
  for (const tag of html.match(/<a\b[^>]*>/gi) ?? []) {
    const href = attribute(tag, 'href')
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) continue
    try { new URL(href, pageUrl).hostname === host ? internalLinks++ : externalLinks++ } catch { /* ignore malformed href */ }
  }
  const canonicalTag = (html.match(/<link\b[^>]*>/gi) ?? []).find(tag => attribute(tag, 'rel').toLowerCase() === 'canonical')
  const structuredDataTypes = [...html.matchAll(/"@type"\s*:\s*"([^"]+)"/g)].map(match => match[1]).filter((type, index, values) => values.indexOf(type) === index).slice(0, 10)
  const metaDescription = meta(html, 'description')
  return {
    httpStatus, title, titleLength: title.length, metaDescription, metaDescriptionLength: metaDescription.length,
    h1Texts, h2Count: headings(body, 2).length, h3Count: headings(body, 3).length, textLength: text(body).length,
    imagesTotal: imgTags.length, imagesMissingAlt: imgTags.filter(tag => !attribute(tag, 'alt').trim()).length,
    internalLinks, externalLinks, canonicalUrl: canonicalTag ? attribute(canonicalTag, 'href') : '',
    hasOgp: Boolean(meta(html, 'og:title') || meta(html, 'og:description')),
    structuredDataTypes, isNoindex: meta(html, 'robots').toLowerCase().includes('noindex'),
  }
}

function diagnose(tech: PageTechAudit): PageAuditAi {
  const issues: string[] = []
  const actions: PageAuditAi['actions'] = []
  let score = tech.httpStatus >= 200 && tech.httpStatus < 400 ? 100 : 45
  const add = (issue: string, title: string, description: string, priority: AuditPriority, deduction = 8) => {
    issues.push(issue); actions.push({ title, description, priority }); score -= deduction
  }
  if (!tech.title) add('タイトルが設定されていません。', 'タイトルを設定', 'ページの検索意図とM&Aロイヤルの強みを含むタイトルを設定します。', 'high', 18)
  else if (tech.titleLength < 24 || tech.titleLength > 36) add(`タイトルが${tech.titleLength}文字です。`, 'タイトル長を最適化', '検索結果で伝わるよう、24〜36文字を目安に調整します。', 'medium', 5)
  if (!tech.metaDescription) add('メタディスクリプションが未設定です。', 'メタ説明を追加', '経営者の課題とページ価値を簡潔に伝える説明文を追加します。', 'high', 12)
  if (tech.h1Texts.length !== 1) add(`H1が${tech.h1Texts.length}件です。`, 'H1を整理', '各ページの主題を表すH1を1つに整理します。', 'high', 12)
  if (tech.imagesMissingAlt > 0) add(`alt未設定の画像が${tech.imagesMissingAlt}枚あります。`, '画像altを補完', '内容を説明するalt属性を追加し、アクセシビリティを改善します。', 'medium')
  if (!tech.hasOgp) add('OGPが設定されていません。', 'OGPを設定', 'SNS共有時に内容が正しく伝わるOGPを設定します。', 'medium')
  if (!tech.canonicalUrl) add('canonicalが未設定です。', 'canonicalを設定', '正規URLを明示し、重複評価のリスクを抑えます。', 'medium')
  if (tech.isNoindex) add('noindexが設定されています。', 'index設定を確認', '公開ページとして検索表示が必要か、意図を確認します。', 'high', 25)
  if (tech.internalLinks < 3) add('内部リンクが少ない状態です。', '関連ページへの導線を追加', 'サービス・実績・相談ページへの自然な内部リンクを追加します。', 'medium', 5)
  if (issues.length === 0) actions.push({ title: '現状の品質を維持', description: '定期診断で技術設定と主要ページの導線を継続監視します。', priority: 'low' })
  return { score: Math.max(0, score), summary: issues.length ? `${issues.length}件の改善候補があります。優先度の高い技術設定と問い合わせ導線から対応してください。` : '主要な技術SEO要素は良好です。コンテンツ更新と導線改善を継続してください。', issues, actions }
}

export async function auditPage(url: string, label: string): Promise<PageAuditResult> {
  if (!isAllowedAuditUrl(url)) throw new Error('診断できるのは ma-la.co.jp 配下のHTTPS URLのみです')
  const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MALoyalSiteAudit/1.0)', Accept: 'text/html' }, cache: 'no-store', redirect: 'follow' })
  const tech = parseHtml(await response.text(), url, response.status)
  const result: PageAuditResult = { url, label, phase: phaseForUrl(url), generatedAt: new Date().toISOString(), tech, ai: diagnose(tech) }
  const document = await loadSiteAuditDocument()
  document.pages[url] = result
  document.updatedAt = result.generatedAt
  await saveDocument(document)
  return result
}

export async function generateSiteAuditOverall(): Promise<SiteAuditOverall> {
  const document = await loadSiteAuditDocument()
  const pages = Object.values(document.pages)
  if (!pages.length) throw new Error('先にページ診断を実行してください')
  const issues = pages.flatMap(page => page.ai.issues).filter((item, index, values) => values.indexOf(item) === index).slice(0, 6)
  const actions = pages.flatMap(page => page.ai.actions.map(action => ({ ...action, category: '技術SEO' }))).slice(0, 6)
  const average = Math.round(pages.reduce((sum, page) => sum + page.ai.score, 0) / pages.length)
  const overall: SiteAuditOverall = {
    generatedAt: new Date().toISOString(),
    summary: `${pages.length}ページの平均スコアは${average}点です。技術SEOの不足とページ間の導線を優先的に改善し、M&Aロイヤルの相談・資料請求への流れを整えてください。`,
    issues,
    actions,
  }
  document.overall = overall
  document.updatedAt = overall.generatedAt
  await saveDocument(document)
  const date = new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10)
  const history = await loadSiteAuditHistory()
  await putS3Object(HISTORY_KEY, JSON.stringify([{ date, savedAt: new Date().toISOString(), pages: document.pages, overall }, ...history.filter(item => item.date !== date)].slice(0, 15)))
  return overall
}
