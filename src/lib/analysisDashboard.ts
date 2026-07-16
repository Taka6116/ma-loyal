import type { AhrefsDataset } from './ahrefsCsvParser'
import { getCategoryCounts, mergeAndAnalyze, type ScoredKeyword } from './ahrefsAnalyzer'

export interface DomainSummary {
  domain: string
  keywordCount: number
  estimatedTraffic: number
  topKeywords: ScoredKeyword[]
}

export function getKeywordData(datasets: AhrefsDataset[]) {
  const keywordDatasets = datasets.filter(dataset => dataset.type === 'keywords')
  const organicDatasets = datasets.filter(dataset => dataset.type === 'organic')
  const marketKeywords = mergeAndAnalyze(keywordDatasets.map(dataset => dataset.keywords))
  const organicKeywords = mergeAndAnalyze(organicDatasets.map(dataset => dataset.keywords))

  return {
    marketKeywords,
    organicKeywords,
    categories: getCategoryCounts(marketKeywords),
    priorityKeywords: marketKeywords.filter(keyword => keyword.priority >= 2),
  }
}

export function summarizeCompetitors(keywords: ScoredKeyword[]): DomainSummary[] {
  const groups = new Map<string, ScoredKeyword[]>()

  for (const keyword of keywords) {
    const domain = toDomain(keyword.url)
    const current = groups.get(domain) ?? []
    current.push(keyword)
    groups.set(domain, current)
  }

  return Array.from(groups.entries())
    .map(([domain, rows]) => ({
      domain,
      keywordCount: rows.length,
      estimatedTraffic: rows.reduce((total, row) => total + Math.max(0, row.currentTraffic ?? 0), 0),
      topKeywords: [...rows].sort((a, b) => (a.position ?? 999) - (b.position ?? 999)).slice(0, 3),
    }))
    .sort((a, b) => b.keywordCount - a.keywordCount || b.estimatedTraffic - a.estimatedTraffic)
}

function toDomain(url?: string): string {
  if (!url) return 'ドメイン未取得'
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'ドメイン未取得'
  }
}
