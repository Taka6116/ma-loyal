import { NextRequest, NextResponse } from 'next/server'
import { generateImagePromptFromArticle } from '@/lib/api/gemini'

function pickRandom<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]!
}

const FALLBACK_PROMPTS = [
  'overhead flat-lay of M&A business contract documents, fountain pen and wine-red folder on dark premium desk, professional stock photography, no readable text, no people',
  'two business professionals in formal suits reviewing merger agreement documents at premium conference desk, hands pointing at contract, faces softly blurred, modern executive office',
  'overhead flat-lay of financial valuation documents and abstract graphs, reading glasses and premium pen on dark mahogany desk, no readable numbers, no people, corporate photography',
  'wide shot of executive conference room, business team from behind with laptops and document binders, M&A strategy meeting atmosphere, silhouettes, no facial close-ups',
  'dramatic low-angle view of modern glass office building, cool charcoal and warm gold tones, financial district, corporate prestige feel, no people',
  'overhead flat-lay of corporate merger paperwork, two hands reaching toward a signed contract page, formal suit cuffs visible, dark desk, no faces',
  'side angle premium business meeting, executives over contract documents and tablets, emphasis on handshake moment, sophisticated modern boardroom, faces not dominant',
] as const

function buildFallbackPrompt(title: string, targetKeyword?: string): string {
  const text = title + (targetKeyword ?? '')
  const isSuccession = /事業承継|後継者|承継/.test(text)
  const isSale = /売却|譲渡|売り手|会社売却/.test(text)
  const isAcquisition = /買収|譲受|買い手/.test(text)
  const isValuation = /株価算定|企業価値|バリュエーション/.test(text)
  const isDiligence = /デューデリ|DD|due diligence/.test(text)

  let theme: string
  if (isSuccession) {
    theme = 'overhead flat-lay of business succession documents and corporate seal on dark premium desk, abstract organizational chart, no readable text, no people'
  } else if (isSale) {
    theme = 'two business professionals in formal suits at premium conference table, contract document signing moment, wine-red accent folder visible, faces softly cropped, sophisticated boardroom'
  } else if (isAcquisition) {
    theme = 'dramatic close-up of two business hands shaking in front of blurred city skyline, formal suit cuffs, deep charcoal and gold tones, no readable text'
  } else if (isValuation) {
    theme = 'overhead flat-lay of financial valuation spreadsheet printouts and abstract bar chart graphics, calculator and fountain pen on dark desk, no legible numbers, no people'
  } else if (isDiligence) {
    theme = 'overhead view of due diligence document binders and tablet showing abstract data chart on clean conference table, premium pen, no readable text, no people'
  } else {
    theme = pickRandom(FALLBACK_PROMPTS)
  }

  return [
    theme,
    'professional Japanese corporate photography',
    'photorealistic high quality',
    'deep wine-red and gold accent color palette, dark charcoal and white tones',
    'soft premium office lighting',
    'M&A advisory corporate editorial stock style',
    'no readable text no watermark no logo, abstract charts only',
    'horizontal 16:9 composition',
  ].join(', ')
}

export async function POST(request: NextRequest) {
  let title: string | undefined
  let content: string | undefined
  let targetKeyword: string | undefined
  try {
    const body = await request.json()
    title = body?.title
    content = typeof body?.content === 'string' ? body.content : undefined
    targetKeyword = body?.targetKeyword
  } catch {
    return NextResponse.json(
      { error: 'リクエスト body の JSON が不正です。' },
      { status: 400 }
    )
  }

  if (!title?.trim()) {
    return NextResponse.json(
      { error: 'タイトルが必要です' },
      { status: 400 }
    )
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json(
      { error: 'GEMINI_API_KEY が設定されていません。' },
      { status: 500 }
    )
  }

  // Geminiで画像プロンプトを生成
  let imagePrompt: string
  try {
    if (title.trim() && content?.trim()) {
      imagePrompt = await generateImagePromptFromArticle(title.trim(), content.trim())
    } else {
      imagePrompt = buildFallbackPrompt(title, targetKeyword)
    }
  } catch (e) {
    console.warn('Gemini image prompt failed, using fallback:', (e as Error)?.message)
    imagePrompt = buildFallbackPrompt(title, targetKeyword)
  }

  // Gemini Imagen 3 で画像生成
  const imagenUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`

  const requestBody = {
    instances: [
      {
        prompt: [
          imagePrompt,
          'Professional corporate stock photography',
          'High quality photorealistic',
          'No readable text numbers logos or watermarks anywhere',
          'Abstract charts and screens only without legible labels',
          'Horizontal 16:9 widescreen composition',
        ].join(', '),
      },
    ],
    parameters: {
      sampleCount: 1,
      aspectRatio: '16:9',
      safetyFilterLevel: 'block_only_high',
      personGeneration: 'allow_adult',
    },
  }

  try {
    const response = await fetch(imagenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('Imagen API error:', response.status, errText)
      // フォールバック：Imagen 3.0 Fast を試みる
      return await tryImagenFast(apiKey, imagePrompt)
    }

    const data = await response.json() as {
      predictions?: Array<{ bytesBase64Encoded?: string; mimeType?: string }>
    }

    const prediction = data.predictions?.[0]
    const base64Image = prediction?.bytesBase64Encoded

    if (!base64Image) {
      console.warn('Imagen returned no image, trying fast model...')
      return await tryImagenFast(apiKey, imagePrompt)
    }

    return NextResponse.json({
      imageBase64: base64Image,
      mimeType: prediction?.mimeType ?? 'image/jpeg',
      prompt: imagePrompt,
    })
  } catch (error) {
    const err = error as Error
    console.error('Imagen image error:', err?.message ?? error)
    return NextResponse.json(
      { error: `画像生成に失敗しました: ${err?.message ?? '不明なエラー'}` },
      { status: 500 }
    )
  }
}

async function tryImagenFast(apiKey: string, imagePrompt: string): Promise<NextResponse> {
  const fastUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-fast-generate-001:predict?key=${apiKey}`
  try {
    const res = await fetch(fastUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [{ prompt: imagePrompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio: '16:9',
          safetyFilterLevel: 'block_only_high',
          personGeneration: 'allow_adult',
        },
      }),
    })
    if (!res.ok) {
      const errText = await res.text()
      return NextResponse.json(
        { error: `画像生成に失敗しました（${res.status}）: ${errText.slice(0, 200)}` },
        { status: 500 }
      )
    }
    const data = await res.json() as {
      predictions?: Array<{ bytesBase64Encoded?: string; mimeType?: string }>
    }
    const prediction = data.predictions?.[0]
    const base64Image = prediction?.bytesBase64Encoded
    if (!base64Image) {
      return NextResponse.json(
        { error: '画像データが返ってきませんでした。しばらくしてから再試行してください。' },
        { status: 500 }
      )
    }
    return NextResponse.json({
      imageBase64: base64Image,
      mimeType: prediction?.mimeType ?? 'image/jpeg',
      prompt: imagePrompt,
    })
  } catch (e) {
    return NextResponse.json(
      { error: `画像生成に失敗しました: ${(e as Error)?.message ?? '不明なエラー'}` },
      { status: 500 }
    )
  }
}
