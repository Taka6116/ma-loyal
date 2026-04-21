import type { AhrefsKeywordRow } from './ahrefsCsvParser'

export type PriorityLevel = 3 | 2 | 1 | 0

export interface ScoredKeyword extends AhrefsKeywordRow {
  opportunityScore: number
  trend: 'up' | 'down' | 'stable'
  detectedCategory: string
  priority: PriorityLevel
}

export interface TrendKeyword {
  keyword: string
  volume: number
  previousVolume: number
  trend: 'up' | 'down' | 'stable'
  changePercent: number
  isNew: boolean
  detectedCategory: string
}

const CATEGORIES = [
  { category: 'M&A全般', patterns: ['m&a', 'エムアンドエー', '合併', '買収', '企業買収', '合併・買収'] },
  { category: '事業承継', patterns: ['事業承継', '事業引き継ぎ', '後継者', '承継', '引き継ぎ', '経営承継'] },
  { category: '会社売却', patterns: ['会社売却', '株式譲渡', '事業売却', '売却', '譲渡', '売り手'] },
  { category: '会社買収', patterns: ['会社買収', '企業買収', '買い手', '譲受', 'バイアウト', '買収先'] },
  { category: '株価算定', patterns: ['株価算定', '企業価値', 'バリュエーション', '株式評価', '企業評価', '時価総額'] },
  { category: 'デューデリジェンス', patterns: ['デューデリジェンス', 'dd', 'デューデリ', '調査', 'due diligence'] },
  { category: '費用・相場', patterns: ['費用', '相場', '手数料', '報酬', '仲介手数料', 'コスト', '成功報酬'] },
  { category: '手続き・流れ', patterns: ['手続き', '流れ', 'プロセス', 'ステップ', '進め方', 'スケジュール'] },
  { category: '中小企業M&A', patterns: ['中小企業', '小規模', '零細', 'sme', '中堅企業', '中堅'] },
  { category: '後継者問題', patterns: ['後継者不足', '後継者問題', '廃業', '跡継ぎ', '引退', '経営者高齢化'] },
  { category: '業種別M&A', patterns: ['製造業', 'it企業', '建設業', '飲食', '介護', '医療', '物流', '小売'] },
  { category: '地域別M&A', patterns: ['地方', '東京', '大阪', '名古屋', '地域', '県', '都市'] },
  { category: '仲介・アドバイザー', patterns: ['仲介', 'アドバイザー', 'fa', 'フィナンシャルアドバイザー', '仲介会社', '仲介業者'] },
  { category: '比較・選定', patterns: ['比較', '選定', '選び方', 'おすすめ', 'ランキング', '違い'] },
  { category: 'リスク・注意点', patterns: ['リスク', '注意点', '失敗', 'トラブル', '落とし穴', 'デメリット'] },
  { category: 'PMI・統合', patterns: ['pmi', '統合', '経営統合', 'ポスト', '組織統合', '文化統合'] },
]

function detectCategory(keyword: string, ahrefsCategory: string): string {
  const lower = keyword.toLowerCase()
  for (const { category, patterns } of CATEGORIES) {
    for (const p of patterns) {
      if (lower.includes(p)) return category
    }
  }
  if (ahrefsCategory) return ahrefsCategory
  return 'その他'
}

function calcOpportunityScore(row: AhrefsKeywordRow): number {
  const volScore = Math.min(row.volume / 1000, 10)
  const kdScore = (100 - row.kd) / 10
  const cpcBonus = Math.min(row.cpc / 500, 2)
  return Math.round((volScore * 4 + kdScore * 5 + cpcBonus * 1) * 10) / 10
}

function calcPriority(
  score: number, kd: number, volume: number, trend: 'up' | 'down' | 'stable',
): PriorityLevel {
  if (score >= 50 && kd <= 30 && volume >= 100) return 3
  if (score >= 40 && kd <= 30 && trend === 'up') return 3
  if (score >= 40 && kd <= 50) return 2
  if (kd <= 20 && volume >= 100) return 2
  if (score >= 20) return 1
  return 0
}

function detectSvTrend(svTrend: number[]): { trend: 'up' | 'down' | 'stable'; changePercent: number } {
  if (svTrend.length < 6) return { trend: 'stable', changePercent: 0 }

  const recent6 = svTrend.slice(-6)
  const older6 = svTrend.length >= 12 ? svTrend.slice(-12, -6) : svTrend.slice(0, Math.min(6, svTrend.length - 6))

  if (older6.length === 0) return { trend: 'stable', changePercent: 0 }

  const recentAvg = recent6.reduce((a, b) => a + b, 0) / recent6.length
  const olderAvg = older6.reduce((a, b) => a + b, 0) / older6.length

  if (olderAvg === 0) return { trend: recentAvg > 0 ? 'up' : 'stable', changePercent: 0 }

  const changeRate = (recentAvg - olderAvg) / olderAvg
  const changePercent = Math.round(changeRate * 1000) / 10

  if (changeRate > 0.1) return { trend: 'up', changePercent }
  if (changeRate < -0.1) return { trend: 'down', changePercent }
  return { trend: 'stable', changePercent }
}

function detectTrafficTrend(row: AhrefsKeywordRow): { trend: 'up' | 'down' | 'stable'; changePercent: number } {
  if (row.trafficChange === null || row.previousTraffic === null) return { trend: 'stable', changePercent: 0 }
  if (row.previousTraffic === 0) {
    return { trend: row.trafficChange > 0 ? 'up' : 'stable', changePercent: 0 }
  }
  const rate = row.trafficChange / row.previousTraffic
  const pct = Math.round(rate * 1000) / 10
  if (rate > 0.1) return { trend: 'up', changePercent: pct }
  if (rate < -0.1) return { trend: 'down', changePercent: pct }
  return { trend: 'stable', changePercent: pct }
}

export function analyzeKeywords(keywords: AhrefsKeywordRow[]): ScoredKeyword[] {
  return keywords
    .map(row => {
      const trendInfo = row.svTrend.length > 0
        ? detectSvTrend(row.svTrend)
        : detectTrafficTrend(row)
      const score = calcOpportunityScore(row)

      return {
        ...row,
        opportunityScore: score,
        trend: trendInfo.trend,
        detectedCategory: detectCategory(row.keyword, row.category),
        priority: calcPriority(score, row.kd, row.volume, trendInfo.trend),
      }
    })
    .sort((a, b) => b.priority - a.priority || b.opportunityScore - a.opportunityScore)
}

export function detectTrends(keywords: AhrefsKeywordRow[]): TrendKeyword[] {
  return keywords
    .filter(kw => kw.svTrend.length >= 6 || kw.trafficChange !== null)
    .map(kw => {
      const info = kw.svTrend.length >= 6
        ? detectSvTrend(kw.svTrend)
        : detectTrafficTrend(kw)

      let previousVolume = 0
      if (kw.svTrend.length >= 12) {
        const older6 = kw.svTrend.slice(-12, -6)
        previousVolume = Math.round(older6.reduce((a, b) => a + b, 0) / older6.length)
      } else if (kw.previousTraffic != null) {
        previousVolume = kw.previousTraffic
      }

      const isNew = previousVolume === 0 && kw.volume > 0

      return {
        keyword: kw.keyword,
        volume: kw.volume,
        previousVolume,
        trend: info.trend,
        changePercent: isNew ? 100 : info.changePercent,
        isNew,
        detectedCategory: detectCategory(kw.keyword, kw.category),
      }
    })
    .filter(t => t.trend !== 'stable')
    .sort((a, b) => {
      if (a.isNew !== b.isNew) return a.isNew ? -1 : 1
      return b.volume - a.volume
    })
}

export function getCategories(scored: ScoredKeyword[]): string[] {
  const set = new Set<string>()
  for (const kw of scored) set.add(kw.detectedCategory)
  return Array.from(set).sort()
}

export interface CategoryCount {
  category: string
  count: number
}

export function getCategoryCounts(scored: ScoredKeyword[]): CategoryCount[] {
  const map = new Map<string, number>()
  for (const kw of scored) {
    map.set(kw.detectedCategory, (map.get(kw.detectedCategory) ?? 0) + 1)
  }
  return Array.from(map.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
}

export function mergeAndAnalyze(
  datasetsKeywords: AhrefsKeywordRow[][],
): ScoredKeyword[] {
  const all: AhrefsKeywordRow[] = []
  for (const kws of datasetsKeywords) all.push(...kws)
  return analyzeKeywords(all)
}
