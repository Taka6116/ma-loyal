import { NextRequest, NextResponse } from 'next/server'
import { fetchOrganicKeywords } from '@/lib/ahrefsApi'
import type { AhrefsDataset } from '@/lib/ahrefsCsvParser'
import { getS3ObjectAsText, putS3Object } from '@/lib/s3Reference'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

const PREFIX = 'kw-analysis/'
const INDEX_KEY = `${PREFIX}index.json`

interface DatasetMeta {
  id: string
  fileName: string
  type: 'keywords' | 'organic'
  rowCount: number
  uploadedAt: string
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim()
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: '認証エラー' }, { status: 401 })
  }

  try {
    const keywords = await fetchOrganicKeywords()
    const now = new Date().toISOString()
    const domain = process.env.AHREFS_TARGET_DOMAIN?.trim() ?? 'unknown'
    const country = process.env.AHREFS_COUNTRY?.trim() ?? 'jp'
    const id = `cron_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    const dataset: AhrefsDataset = {
      id,
      uploadedAt: now,
      fileName: `Ahrefs API（自社KW・自動）- ${domain} (${country})`,
      rowCount: keywords.length,
      type: 'organic',
      keywords,
    }
    if (!await putS3Object(`${PREFIX}datasets/${id}.json`, JSON.stringify(dataset))) {
      throw new Error('S3への保存に失敗しました')
    }
    const object = await getS3ObjectAsText(INDEX_KEY)
    let index: DatasetMeta[] = []
    try { index = object ? JSON.parse(object.content) as DatasetMeta[] : [] } catch { /* 空の索引から再作成 */ }
    await putS3Object(INDEX_KEY, JSON.stringify([...index, {
      id,
      fileName: dataset.fileName,
      type: dataset.type,
      rowCount: dataset.rowCount,
      uploadedAt: now,
    }]))
    return NextResponse.json({ ok: true, rowCount: keywords.length, id })
  } catch (error) {
    console.error('[Ahrefs cron]', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Ahrefs自動同期に失敗しました' }, { status: 500 })
  }
}
