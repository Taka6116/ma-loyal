import { NextRequest, NextResponse } from 'next/server'
import {
  analyzeCompetitor,
  buildKeywordOpportunities,
  DEFAULT_COMPETITORS,
  fetchApiUsage,
  generateStrategy,
  loadCompetitiveDocument,
  loadCompetitorConfig,
  refreshCompetitorKeywords,
  saveCompetitorConfig,
  type CompetitorConfig,
} from '@/lib/competitiveAnalysis'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET() {
  try {
    const [config, document, usage] = await Promise.all([
      loadCompetitorConfig(),
      loadCompetitiveDocument(),
      fetchApiUsage(),
    ])
    return NextResponse.json({ config, document, opportunities: buildKeywordOpportunities(config, document), usage, defaults: DEFAULT_COMPETITORS })
  } catch (error) {
    console.error('[competitive-analysis GET]', error)
    return NextResponse.json({ error: '競合分析データの取得に失敗しました' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({})) as { action?: string; competitorId?: string; config?: CompetitorConfig[] }
    if (body.action === 'save-config' && Array.isArray(body.config)) {
      await saveCompetitorConfig(body.config)
      return NextResponse.json({ ok: true })
    }
    if (body.action === 'analyze-competitor' && body.competitorId) {
      return NextResponse.json({ result: await analyzeCompetitor(body.competitorId) })
    }
    if (body.action === 'refresh-keywords' && body.competitorId) {
      return NextResponse.json({ result: await refreshCompetitorKeywords(body.competitorId) })
    }
    if (body.action === 'generate-strategy') {
      return NextResponse.json({ actions: await generateStrategy() })
    }
    return NextResponse.json({ error: '実行内容が不正です' }, { status: 400 })
  } catch (error) {
    console.error('[competitive-analysis POST]', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : '競合分析の実行に失敗しました' }, { status: 500 })
  }
}
