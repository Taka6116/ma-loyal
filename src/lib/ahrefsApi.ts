import type { AhrefsKeywordRow } from './ahrefsCsvParser'

const BASE_URL = 'https://api.ahrefs.com/v3'

interface AhrefsOrganicRow {
  keyword: string
  best_position: number | null
  best_position_url: string | null
  volume: number | null
  keyword_difficulty: number | null
  cpc: number | null
  sum_traffic: number | null
  is_informational: boolean | null
  is_commercial: boolean | null
  is_transactional: boolean | null
  is_navigational: boolean | null
}

interface AhrefsOrganicResponse {
  keywords?: AhrefsOrganicRow[]
}

export interface AhrefsApiOptions {
  target?: string
  country?: string
  limit?: number
  date?: string
}

function recentDate(): string {
  const date = new Date()
  date.setDate(date.getDate() - 5)
  return date.toISOString().slice(0, 10)
}

function intents(row: AhrefsOrganicRow): string {
  return [
    row.is_informational && 'Informational',
    row.is_commercial && 'Commercial',
    row.is_transactional && 'Transactional',
    row.is_navigational && 'Navigational',
  ].filter(Boolean).join(',')
}

function mapOrganicRow(row: AhrefsOrganicRow): AhrefsKeywordRow {
  return {
    keyword: row.keyword,
    volume: row.volume ?? 0,
    kd: row.keyword_difficulty ?? 0,
    cpc: row.cpc != null ? Math.round(row.cpc) / 100 : 0,
    cps: 0,
    parentTopic: '',
    svTrend: [],
    svForecast: [],
    category: '',
    trafficPotential: 0,
    globalVolume: 0,
    intents: intents(row),
    position: row.best_position,
    positionChange: null,
    url: row.best_position_url ?? '',
    currentTraffic: row.sum_traffic,
    previousTraffic: null,
    trafficChange: null,
    branded: false,
    serpFeatures: '',
  }
}

export async function fetchOrganicKeywords(options: AhrefsApiOptions = {}): Promise<AhrefsKeywordRow[]> {
  const apiKey = process.env.AHREFS_API_KEY?.trim()
  const target = options.target ?? process.env.AHREFS_TARGET_DOMAIN?.trim()
  const country = options.country ?? process.env.AHREFS_COUNTRY?.trim() ?? 'jp'

  if (!apiKey) throw new Error('AHREFS_API_KEY が設定されていません')
  if (!target) throw new Error('AHREFS_TARGET_DOMAIN が設定されていません')

  const params = new URLSearchParams({
    target,
    mode: 'domain',
    country,
    date: options.date ?? recentDate(),
    limit: String(Math.min(Math.max(options.limit ?? 500, 1), 1000)),
    select: [
      'keyword',
      'best_position',
      'best_position_url',
      'volume',
      'keyword_difficulty',
      'cpc',
      'sum_traffic',
      'is_informational',
      'is_commercial',
      'is_transactional',
      'is_navigational',
    ].join(','),
    order_by: 'sum_traffic:desc',
  })
  const response = await fetch(`${BASE_URL}/site-explorer/organic-keywords?${params}`, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Ahrefs API エラー ${response.status}: ${detail.slice(0, 240)}`)
  }

  const data = await response.json() as AhrefsOrganicResponse
  return (data.keywords ?? []).map(mapOrganicRow)
}

export async function fetchApiUsage(): Promise<{ units_used_this_month: number; units_limit_per_month: number } | null> {
  const apiKey = process.env.AHREFS_API_KEY?.trim()
  if (!apiKey) return null
  try {
    const response = await fetch(`${BASE_URL}/subscription-info/limits-and-usage`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!response.ok) return null
    const data = await response.json() as Record<string, unknown>
    const used = Number(data.units_used_this_month)
    const limit = Number(data.units_limit_per_month)
    return Number.isFinite(used) && Number.isFinite(limit) ? { units_used_this_month: used, units_limit_per_month: limit } : null
  } catch {
    return null
  }
}
