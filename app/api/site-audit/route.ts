import { NextRequest, NextResponse } from 'next/server'
import { auditPage, DEFAULT_AUDIT_PAGES, generateSiteAuditOverall, loadSiteAuditDocument, loadSiteAuditHistory } from '@/lib/siteAudit'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET() {
  try {
    const [doc, history] = await Promise.all([loadSiteAuditDocument(), loadSiteAuditHistory()])
    return NextResponse.json({ doc, history, defaultPages: DEFAULT_AUDIT_PAGES })
  } catch (error) {
    console.error('[SiteAudit GET]', error)
    return NextResponse.json({ error: '診断結果の取得に失敗しました' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({})) as { action?: string; url?: string; label?: string }
    if (body.action === 'page') {
      if (!body.url) return NextResponse.json({ error: 'URLを指定してください' }, { status: 400 })
      return NextResponse.json({ result: await auditPage(body.url, body.label || body.url) })
    }
    if (body.action === 'overall') return NextResponse.json({ overall: await generateSiteAuditOverall() })
    return NextResponse.json({ error: '不正な操作です' }, { status: 400 })
  } catch (error) {
    console.error('[SiteAudit POST]', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : '診断の実行に失敗しました' }, { status: 500 })
  }
}
