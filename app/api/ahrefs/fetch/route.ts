import { NextRequest, NextResponse } from 'next/server'
import { fetchApiUsage, fetchOrganicKeywords } from '@/lib/ahrefsApi'
import type { AhrefsDataset } from '@/lib/ahrefsCsvParser'
import { getS3ObjectAsText, putS3Object } from '@/lib/s3Reference'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const PREFIX = 'kw-analysis/'
const INDEX_KEY = `${PREFIX}index.json`

interface DatasetMeta {
  id: string
  fileName: string
  type: 'keywords' | 'organic'
  rowCount: number
  uploadedAt: string
}

async function loadIndex(): Promise<DatasetMeta[]> {
  const object = await getS3ObjectAsText(INDEX_KEY)
  if (!object) return []
  try { return JSON.parse(object.content) as DatasetMeta[] } catch { return [] }
}

export async function GET() {
  const apiKey = process.env.AHREFS_API_KEY?.trim()
  const domain = process.env.AHREFS_TARGET_DOMAIN?.trim()
  return NextResponse.json({
    configured: Boolean(apiKey && domain),
    domain: domain ?? null,
    country: process.env.AHREFS_COUNTRY?.trim() ?? 'jp',
    hasApiKey: Boolean(apiKey),
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({})) as { target?: string; country?: string; limit?: number }
    const target = body.target ?? process.env.AHREFS_TARGET_DOMAIN?.trim()
    const country = body.country ?? process.env.AHREFS_COUNTRY?.trim() ?? 'jp'
    if (!target) return NextResponse.json({ error: '対象ドメインを設定してください' }, { status: 400 })

    const keywords = await fetchOrganicKeywords({ target, country, limit: body.limit })
    if (keywords.length === 0) return NextResponse.json({ error: 'キーワードデータが見つかりませんでした' }, { status: 404 })

    const now = new Date().toISOString()
    const id = `api_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    const dataset: AhrefsDataset = {
      id,
      uploadedAt: now,
      fileName: `Ahrefs API（自社KW）- ${target} (${country})`,
      rowCount: keywords.length,
      type: 'organic',
      keywords,
    }
    if (!await putS3Object(`${PREFIX}datasets/${id}.json`, JSON.stringify(dataset))) {
      return NextResponse.json({ error: 'S3への保存に失敗しました' }, { status: 500 })
    }

    const index = await loadIndex()
    const meta: DatasetMeta = { id, fileName: dataset.fileName, type: dataset.type, rowCount: dataset.rowCount, uploadedAt: now }
    await putS3Object(INDEX_KEY, JSON.stringify([...index, meta]))
    await putS3Object(`${PREFIX}history/${now.slice(0, 10)}.json`, JSON.stringify({
      date: now.slice(0, 10),
      fetchedAt: now,
      domain: target,
      country,
      keywords: keywords.map(row => ({ keyword: row.keyword, position: row.position, volume: row.volume, traffic: row.currentTraffic, url: row.url })),
    }))

    return NextResponse.json({ dataset: meta, usage: await fetchApiUsage() })
  } catch (error) {
    console.error('[Ahrefs fetch]', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Ahrefs API同期に失敗しました' }, { status: 500 })
  }
}
