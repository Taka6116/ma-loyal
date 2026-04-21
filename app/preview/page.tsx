'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useCallback, useMemo, useState, useEffect, Suspense } from 'react'
import StepIndicator from '@/components/editor/StepIndicator'
import type { Step } from '@/lib/types'
import { getSupervisorBlockHtml } from '@/lib/supervisorBlock'

const DUMMY_ARTICLES = [
  {
    date: '2024.11.15',
    category: 'M&Aの基礎',
    title: 'M&A成功のカギ！中小企業が知っておくべき事業承継の5つのポイント',
  },
  {
    date: '2024.06.28',
    category: '売却・譲渡',
    title: '会社売却の流れをわかりやすく解説！M&Aの基本ステップと注意点',
  },
]

const SUPERVISOR_FACE_IMAGE_URL = ''

function getPreviewCtaBannerHtml(): string {
  return `<div style="margin:48px 0;padding:28px 32px;background:#9b0000;border-radius:4px;position:relative;overflow:hidden;">
  <div style="position:relative;z-index:1;">
    <p style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.8);letter-spacing:0.1em;margin:0 0 4px;font-family:'Yu Gothic','YuGothic',sans-serif;">無料相談</p>
    <p style="font-size:22px;font-weight:900;color:#fff;margin:0 0 4px;font-family:'Yu Mincho','YuMincho',serif;line-height:1.4;">M&Aの<span style="font-size:28px;">メリット・デメリット</span></p>
    <p style="font-size:18px;font-weight:700;color:#fff;margin:0 0 20px;font-family:'Yu Mincho','YuMincho',serif;">私と話してみませんか？</p>
    <a href="https://ma-la.co.jp/inquiry/" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:8px;padding:12px 28px;background:#97876A;color:#fff;border-radius:4px;text-decoration:none;font-weight:700;font-size:14px;font-family:'Yu Gothic','YuGothic',sans-serif;">無料相談のご案内 →</a>
  </div>
</div>`
}

function insertCtaBannersForPreview(html: string): string {
  const cta = getPreviewCtaBannerHtml()

  const matomeRegex = /<h2[^>]*>[^<]*まとめ[^<]*<\/h2>/gi
  const matomeMatch = matomeRegex.exec(html)
  if (matomeMatch) {
    return html.slice(0, matomeMatch.index) + cta + '\n' + html.slice(matomeMatch.index)
  }

  const matomeBlockRegex = /<(h2|h3|p)[^>]*>\s*(?:<strong>)?\s*まとめ[\s\S]*?<\/\1>/i
  const matomeBlockMatch = matomeBlockRegex.exec(html)
  if (matomeBlockMatch && matomeBlockMatch.index !== undefined) {
    return html.slice(0, matomeBlockMatch.index) + cta + '\n' + html.slice(matomeBlockMatch.index)
  }

  const h2Regex = /<h2[\s>]/gi
  let match: RegExpExecArray | null
  const positions: number[] = []
  while ((match = h2Regex.exec(html)) !== null) {
    positions.push(match.index)
  }
  if (positions.length >= 2) {
    const lastPos = positions[positions.length - 1]!
    return html.slice(0, lastPos) + cta + '\n' + html.slice(lastPos)
  }

  return html + '\n' + cta
}

function formatContent(content: string): string {
  const supervisorBlock = getSupervisorBlockHtml(SUPERVISOR_FACE_IMAGE_URL)

  const H2_STYLE = "font-size:20px;font-weight:700;margin:48px 0 16px;padding:14px 20px;background:#222222;color:#fff;border-radius:4px;font-family:'Yu Gothic','YuGothic','Noto Sans JP',sans-serif;"
  const H3_STYLE = 'font-size:18px;font-weight:400;margin:32px 0 12px;color:#111;'
  const P_STYLE = 'margin-bottom:1.6em;'

  const applyInlineFormatting = (text: string): string =>
    text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/__([^_]+?)__/g, '$1')
      .replace(/(?<!\*)\*(?!\*)([^*]+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>')
      .replace(/\*\*/g, '')

  const lines = content.split('\n')
  const htmlLines: string[] = []
  let currentParagraph: string[] = []

  const flushParagraph = () => {
    if (currentParagraph.length === 0) return
    const raw = currentParagraph.join('<br>').trim()
    if (raw) {
      htmlLines.push(`<p style="${P_STYLE}">${applyInlineFormatting(raw)}</p>`)
    }
    currentParagraph = []
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      flushParagraph()
      continue
    }

    if (/^\d+[．.]\s/.test(trimmed) && currentParagraph.length === 0) {
      const text = trimmed.replace(/^\d+[．.]\s*/, '')
      htmlLines.push(`<h2 style="${H2_STYLE}">${applyInlineFormatting(text)}</h2>`)
      continue
    }

    if (/^\d+-\d+[．.]\s/.test(trimmed) && currentParagraph.length === 0) {
      const text = trimmed.replace(/^\d+-\d+[．.]\s*/, '').replace(/\*\*(.+?)\*\*/g, '$1')
      htmlLines.push(`<h3 style="${H3_STYLE}">${text}</h3>`)
      continue
    }

    if (/^[■▶◆●▼]\s/.test(trimmed)) {
      flushParagraph()
      const text = trimmed.replace(/^[■▶◆●▼]\s*/, '').replace(/\*\*(.+?)\*\*/g, '$1')
      htmlLines.push(`<h3 style="${H3_STYLE}">${text}</h3>`)
      continue
    }

    currentParagraph.push(trimmed)
  }

  flushParagraph()
  let bodyHtml = htmlLines.join('\n')

  bodyHtml = bodyHtml
    .replace(
      /導入事例はこちらから\s+https?:\/\/www\.rice-cloud\.info\/casestudy\/?/g,
      '<a href="https://www.rice-cloud.info/casestudy/" target="_blank" rel="noopener noreferrer" style="color:#3EA8D8;text-decoration:underline;">導入事例はこちらから</a>'
    )
    .replace(
      /お問い合わせはこちら\s+https?:\/\/www\.rice-cloud\.info\/contact\/?/g,
      '<a href="https://www.rice-cloud.info/contact/" target="_blank" rel="noopener noreferrer" style="color:#3EA8D8;text-decoration:underline;">お問い合わせはこちら</a>'
    )

  bodyHtml = insertCtaBannersForPreview(bodyHtml)

  return supervisorBlock + bodyHtml
}

function PreviewLoading({ title }: { title: string }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#fff',
      }}
    >
      <style>{`
        @keyframes rc-pulse {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.15); opacity: 1; }
        }
        @keyframes rc-progress {
          0% { width: 0; }
          60% { width: 70%; }
          100% { width: 100%; }
        }
        @keyframes rc-fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #1a2744, #3EA8D8)',
          animation: 'rc-pulse 1.4s ease-in-out infinite',
          marginBottom: 28,
        }}
      />

      <p
        style={{
          fontSize: 15,
          fontWeight: 600,
          color: '#1a2744',
          fontFamily: '"Noto Sans JP", sans-serif',
          marginBottom: 20,
          animation: 'rc-fade-in 0.5s ease-out',
        }}
      >
        記事プレビューを準備しています
      </p>

      <div
        style={{
          width: 220,
          height: 3,
          borderRadius: 2,
          background: '#E8ECF0',
          overflow: 'hidden',
          marginBottom: 24,
        }}
      >
        <div
          style={{
            height: '100%',
            borderRadius: 2,
            background: 'linear-gradient(90deg, #3EA8D8, #1a2744)',
            animation: 'rc-progress 1.8s ease-out forwards',
          }}
        />
      </div>

      {title && title !== '（タイトルなし）' && (
        <p
          style={{
            fontSize: 13,
            color: '#94A3B8',
            fontFamily: '"Noto Sans JP", sans-serif',
            maxWidth: 400,
            textAlign: 'center',
            lineHeight: 1.6,
            animation: 'rc-fade-in 0.7s ease-out 0.2s both',
          }}
        >
          {title}
        </p>
      )}
    </div>
  )
}

function PreviewContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const title = searchParams.get('title') || '（タイトルなし）'
  const contentFromUrl = searchParams.get('content') || ''
  const [storageContent, setStorageContent] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [wordpressUrl, setWordpressUrl] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  const isPublishedPreview = searchParams.get('source') === 'published'

  useEffect(() => {
    if (typeof window === 'undefined') return

    setStorageContent(sessionStorage.getItem('preview_content') || '')
    const id = searchParams.get('articleId')
    let storedImage = ''
    let wp: string | null = null

    if (id) {
      try {
        const raw = localStorage.getItem('nas_articles')
        if (raw) {
          const articles = JSON.parse(raw)
          const match = articles.find((a: { id?: string }) => a.id === id)
          if (match) {
            if (typeof match.wordpressUrl === 'string' && match.wordpressUrl.trim()) {
              wp = match.wordpressUrl.trim()
            }
            if (match.imageUrl) storedImage = match.imageUrl
          }
        }
      } catch {
        /* ignore */
      }
    }

    setWordpressUrl(wp)
    if (storedImage) {
      setImageUrl(storedImage)
    } else {
      const sessionImage = sessionStorage.getItem('preview_image')
      setImageUrl(sessionImage || searchParams.get('imageUrl') || '')
    }

    requestAnimationFrame(() => setReady(true))
  }, [searchParams])

  const content = contentFromUrl || storageContent
  const category = searchParams.get('category') || 'お役立ち情報'
  const date = searchParams.get('date') || new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'numeric', day: 'numeric' }).replace(/\//g, '.')
  const articleId = searchParams.get('articleId') || ''

  const formattedContent = useMemo(
    () => formatContent(content),
    [content]
  )

  const handlePublish = useCallback(() => {
    if (articleId) {
      router.push(`/editor?articleId=${articleId}&step=5`)
    } else {
      router.push('/editor?step=5')
    }
  }, [articleId, router])

  const handleStepClick = useCallback(
    (step: Step) => {
      const base = articleId ? `/editor?articleId=${articleId}&step=` : '/editor?step='
      if (step === 1) {
        router.push(`${base}1`)
      } else if (step === 2) {
        router.push(`${base}2`)
      } else if (step === 3) {
        router.push(`${base}3`)
      } else if (step === 4) {
        // current
      } else if (step === 5) {
        handlePublish()
      }
    },
    [articleId, router, handlePublish]
  )

  if (!ready) return <PreviewLoading title={title} />

  return (
    <div style={{ minHeight: '100vh', background: '#fff', animation: 'rc-fade-in 0.4s ease-out' }}>
      <style>{`
        @keyframes rc-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
      {/* 固定バナー（プレビューモード） */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 220,
          right: 0,
          zIndex: 1000,
        backgroundColor: '#222222',
        color: 'white',
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20 }}>👁️</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>プレビューモード</div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>
              {isPublishedPreview
                ? '投稿済み記事の表示確認（編集はできません）'
                : '実際のサイトでの表示イメージを確認しています'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, flexShrink: 0, alignItems: 'center', flexWrap: 'wrap' }}>
          {isPublishedPreview ? (
            <>
              <button
                type="button"
                onClick={() => router.push('/published')}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.5)',
                  color: 'white',
                  padding: '10px 20px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                ← 一覧に戻る
              </button>
              {wordpressUrl && (
                <a
                  href={wordpressUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    backgroundColor: '#97876A',
                    border: 'none',
                    color: 'white',
                    padding: '10px 24px',
                    borderRadius: 6,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: 14,
                    textDecoration: 'none',
                    display: 'inline-block',
                  }}
                >
                  WordPressで開く
                </a>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => (articleId ? router.push(`/editor?articleId=${articleId}&step=3`) : router.push('/editor?step=3'))}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.5)',
                  color: 'white',
                  padding: '10px 20px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                ← 戻る
              </button>
              <button
                type="button"
                onClick={handlePublish}
                style={{
                  backgroundColor: '#97876A',
                  border: 'none',
                  color: 'white',
                  padding: '10px 24px',
                  borderRadius: 6,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontSize: 14,
                }}
              >
                投稿画面へ
              </button>
            </>
          )}
        </div>
      </div>

      {/* メインコンテンツ + ステップインジケーター */}
      <div style={{ paddingTop: 56, display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>

      {/* ヘッダー（M&A LOYALサイト再現） */}
      <header
        style={{
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #E8E0D5',
          padding: '0',
          position: 'sticky',
          top: 56,
          zIndex: 998,
        }}
      >
        {/* 上段：電話 + CTAボタン */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 12,
          padding: '8px 32px',
          borderBottom: '1px solid #F0EBE3',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginRight: 8 }}>
            <a href="tel:03-6269-3040" style={{
              fontSize: 18,
              fontWeight: 900,
              color: '#222222',
              textDecoration: 'none',
              fontFamily: "'Yu Mincho','YuMincho',serif",
              letterSpacing: '0.04em',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              <svg width="13" height="17" fill="currentColor" viewBox="0 0 11 15"><path d="M2.404 9.364c2.594 4.948 5.507 5.453 6.354 5.009l.22-.116-1.983-3.783-.222.114c-.683.36-1.365-.676-2.239-2.342C3.661 6.58 3.196 5.43 3.88 5.072l.22-.117-1.984-3.782-.22.116c-.848.445-2.085 3.132.509 8.075zm7.775 4.264c.327-.172.147-.548-.04-.903l-1.332-2.54c-.143-.274-.38-.428-.57-.327-.12.063-.401.196-.762.375l1.98 3.774.724-.38zM5.313 4.286c.19-.1.198-.381.056-.657-.143-.276-1.332-2.54-1.332-2.54-.19-.355-.393-.717-.722-.545l-.724.38L4.571 4.7c.352-.196.62-.352.742-.414z"/></svg>
              03-6269-3040
            </a>
            <span style={{ fontSize: 11, color: '#808080', fontWeight: 600, fontFamily: "'Yu Gothic','YuGothic',sans-serif" }}>無料相談はお気軽に</span>
          </div>
          <a
            href="https://ma-la.co.jp/inquiry/"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              backgroundColor: '#9b0000',
              color: 'white',
              padding: '10px 18px',
              borderRadius: 4,
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              whiteSpace: 'nowrap',
              textDecoration: 'none',
              fontFamily: "'Yu Gothic','YuGothic',sans-serif",
            }}
          >
            ✉ 無料相談フォーム
          </a>
          <a
            href="https://ma-la.co.jp/download/"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              backgroundColor: '#97876A',
              color: 'white',
              padding: '10px 18px',
              borderRadius: 4,
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              whiteSpace: 'nowrap',
              textDecoration: 'none',
              fontFamily: "'Yu Gothic','YuGothic',sans-serif",
            }}
          >
            ↓ 資料ダウンロード
          </a>
        </div>
        {/* 下段：ロゴ + ナビ */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 32px',
          minHeight: 56,
        }}>
          <div style={{ fontWeight: 900, fontSize: 17, color: '#222222', letterSpacing: '0.05em', whiteSpace: 'nowrap', fontFamily: "'Yu Mincho','YuMincho',serif" }}>
            M&amp;Aロイヤルアドバイザリー
          </div>
          <nav style={{
            display: 'flex',
            gap: 24,
            fontSize: 13,
            color: '#222222',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            fontFamily: "'Yu Mincho','YuMincho',serif",
          }}>
            {['当社のM&A仲介', 'サービス紹介', 'M&A成約実績', 'M&A案件', 'M&A情報', '会社概要', 'よくある質問'].map(item => (
              <span key={item} style={{ cursor: 'pointer', padding: '16px 0', display: 'inline-block' }}>
                {item}
              </span>
            ))}
          </nav>
        </div>
      </header>

      {/* ファーストビュー（p-sub-fv 再現：ダークバナー） */}
      <section style={{
        backgroundColor: '#222222',
        padding: '48px 0',
        width: '100%',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 40px' }}>
          <h1 style={{
            fontSize: 26,
            fontWeight: 700,
            color: '#ffffff',
            fontFamily: "'Yu Mincho','YuMincho',serif",
            letterSpacing: '0.03em',
            lineHeight: 1.6,
            margin: 0,
          }}>
            {title}
          </h1>
        </div>
      </section>

      {/* CTAバナー帯（c-bnr 再現） */}
      <div style={{
        backgroundColor: '#FAF8F5',
        borderBottom: '1px solid #E8E0D5',
        padding: '16px 40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
      }}>
        <p style={{
          fontSize: 13,
          fontWeight: 700,
          color: '#9b0000',
          fontFamily: "'Yu Mincho','YuMincho',serif",
          margin: 0,
          letterSpacing: '0.05em',
        }}>
          着手金・中間金無料 完全成功報酬型
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <a
            href="https://ma-la.co.jp/inquiry/sellside/"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-block',
              padding: '10px 20px',
              backgroundColor: '#9b0000',
              color: '#fff',
              borderRadius: 4,
              textDecoration: 'none',
              fontSize: 13,
              fontWeight: 700,
              fontFamily: "'Yu Gothic','YuGothic',sans-serif",
              lineHeight: 1.4,
              textAlign: 'center',
            }}
          >
            譲渡・売却・事業承継<br />
            <span style={{ fontSize: 11 }}>無料相談のご案内</span>
          </a>
          <a
            href="https://ma-la.co.jp/inquiry/buyside/"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-block',
              padding: '10px 20px',
              backgroundColor: '#97876A',
              color: '#fff',
              borderRadius: 4,
              textDecoration: 'none',
              fontSize: 13,
              fontWeight: 700,
              fontFamily: "'Yu Gothic','YuGothic',sans-serif",
              lineHeight: 1.4,
              textAlign: 'center',
            }}
          >
            譲受・買収・成長戦略<br />
            <span style={{ fontSize: 11 }}>無料相談のご案内</span>
          </a>
        </div>
      </div>

      {/* パンくずリスト（p-single__breadcrumb 再現） */}
      <div style={{
        maxWidth: 1100,
        margin: '0 auto',
        padding: '12px 24px',
      }}>
        <nav style={{ fontSize: 12, color: '#808080', fontFamily: "'Yu Mincho','YuMincho',serif" }} aria-label="パンくず">
          <span style={{ color: '#9b0000', cursor: 'pointer' }}>HOME</span>
          <span style={{ margin: '0 6px' }}>&gt;</span>
          <span style={{ color: '#9b0000', cursor: 'pointer' }}>M&amp;Aとは</span>
          <span style={{ margin: '0 6px' }}>&gt;</span>
          <span style={{ color: '#9b0000', cursor: 'pointer' }}>経営・ビジネス</span>
          <span style={{ margin: '0 6px' }}>&gt;</span>
          <span>{title.length > 40 ? `${title.slice(0, 40)}...` : title}</span>
        </nav>
      </div>

      {/* 記事メインコンテンツ（2カラム：メイン + サイドバー） */}
      <section style={{ padding: '0 0 80px' }}>
        <div
          style={{
            maxWidth: 1100,
            margin: '48px auto',
            padding: '0 24px',
            display: 'flex',
            gap: 40,
            alignItems: 'flex-start',
          }}
        >
          {/* === 左：メインカラム === */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <header style={{ marginBottom: 32 }}>
              {/* タグ → タイトル → 日付（実サイト順） */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                {['M&A', '事業承継', '売却・譲渡', '中小企業', 'M&Aの基礎'].map(tag => (
                  <span
                    key={tag}
                    style={{
                      display: 'inline-block',
                      padding: '4px 14px',
                      borderRadius: 4,
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'white',
                      backgroundColor: '#97876A',
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <h1
                style={{
                  fontSize: 26,
                  fontWeight: 900,
                  lineHeight: 1.6,
                  color: '#111',
                  marginBottom: 12,
                  fontFamily: '"Noto Sans JP", sans-serif',
                }}
              >
                {title}
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <time style={{ color: '#666', fontWeight: 500, fontSize: 14 }}>
                  {date}
                </time>
              </div>
            </header>

            {/* アイキャッチ画像（タイトル直下、本文の前） */}
            {imageUrl && (
              <div style={{ marginBottom: 32 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt=""
                  style={{
                    width: '100%',
                    height: 'auto',
                    display: 'block',
                    borderRadius: 4,
                  }}
                />
              </div>
            )}

            {/* 記事本文 */}
            <div
              style={{
                fontFamily: '"Noto Sans JP", sans-serif',
                fontSize: 16,
                lineHeight: 1.9,
                color: '#333',
              }}
              dangerouslySetInnerHTML={{ __html: formattedContent }}
            />

            {/* 記事末タグバッジ */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 48, paddingTop: 24, borderTop: '1px solid #e5e5e5' }}>
              {['M&A', '事業承継', '売却・譲渡', '中小企業', 'M&Aの基礎'].map(tag => (
                <span
                  key={tag}
                  style={{
                    display: 'inline-block',
                    padding: '5px 14px',
                    borderRadius: 4,
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'white',
                    backgroundColor: '#97876A',
                    cursor: 'pointer',
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>

            {/* ページネーション */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: 32,
                paddingTop: 20,
                paddingBottom: 20,
                borderTop: '1px solid #e5e5e5',
                borderBottom: '1px solid #e5e5e5',
                fontFamily: '"Noto Sans JP", sans-serif',
              }}
            >
              <span style={{ fontSize: 14, color: '#333', cursor: 'pointer' }}>
                &laquo; 前の記事
              </span>
              <span style={{ fontSize: 14, color: '#333', cursor: 'pointer' }}>
                次の記事 &raquo;
              </span>
            </div>

            {/* 関連記事（p-ma-related 再現） */}
            <div style={{ marginTop: 64, borderTop: '2px solid #222222', paddingTop: 48 }}>
              <h2 style={{
                marginBottom: 8,
                fontSize: 22,
                fontWeight: 700,
                color: '#222',
                fontFamily: "'Yu Mincho','YuMincho',serif",
                letterSpacing: '0.04em',
              }}>
                関連記事のご案内
              </h2>
              <p style={{
                fontSize: 13,
                color: '#808080',
                fontFamily: "'Yu Gothic','YuGothic',sans-serif",
                marginBottom: 28,
              }}>
                M&amp;Aロイヤルアドバイザリーでご用意している関連記事をご紹介いたします。
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
                {DUMMY_ARTICLES.map((article, i) => (
                  <div
                    key={i}
                    style={{
                      backgroundColor: 'white',
                      borderRadius: 4,
                      overflow: 'hidden',
                      border: '1px solid #E8E0D5',
                      cursor: 'pointer',
                    }}
                  >
                    <div
                      style={{
                        width: '100%',
                        aspectRatio: '16/9',
                        backgroundColor: '#FAF8F5',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 24,
                        borderBottom: '1px solid #E8E0D5',
                      }}
                    >
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#222222', letterSpacing: '0.05em', display: 'block', marginBottom: 4, fontFamily: "'Yu Mincho','YuMincho',serif" }}>
                        M&amp;Aロイヤルアドバイザリー
                      </span>
                      <span style={{ fontSize: 9, fontWeight: 600, color: '#97876A', letterSpacing: '0.08em', fontFamily: "'Yu Gothic','YuGothic',sans-serif" }}>
                        M&amp;A・事業承継・売却の仲介
                      </span>
                    </div>
                    <div style={{ padding: '12px 16px 16px' }}>
                      <span style={{ fontSize: 11, color: '#97876A', fontWeight: 700, fontFamily: "'Yu Gothic','YuGothic',sans-serif" }}>
                        {article.category}
                      </span>
                      <p style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.6, color: '#111', marginTop: 4, fontFamily: "'Yu Mincho','YuMincho',serif" }}>
                        {article.title}
                      </p>
                      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                        <span style={{ fontSize: 12, color: '#9b0000', fontWeight: 700, cursor: 'pointer', fontFamily: "'Yu Gothic','YuGothic',sans-serif" }}>
                          詳細を見る →
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ textAlign: 'center', marginTop: 32 }}>
                <a
                  href="https://ma-la.co.jp/m-and-a/all-articles/"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '14px 40px',
                    backgroundColor: '#9b0000',
                    color: '#fff',
                    borderRadius: 4,
                    textDecoration: 'none',
                    fontSize: 14,
                    fontWeight: 700,
                    fontFamily: "'Yu Gothic','YuGothic',sans-serif",
                    letterSpacing: '0.05em',
                  }}
                >
                  M&amp;A記事一覧へ →
                </a>
              </div>
            </div>
          </div>

          {/* === 右：サイドバー === */}
          <div style={{ width: 260, flexShrink: 0, position: 'sticky', top: 130, fontFamily: '"Noto Sans JP", sans-serif' }}>
            {/* 絞り込み検索 */}
            <div style={{ marginBottom: 32, border: '1px solid #e0e0e0', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ backgroundColor: '#222222', color: 'white', padding: '12px 16px', fontSize: 14, fontWeight: 700, textAlign: 'center' }}>
                絞り込み検索
              </div>
              <div style={{ padding: 16 }}>
                <select
                  style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid #D5C9B8', borderRadius: 4, marginBottom: 16, color: '#333', background: 'white' }}
                  defaultValue="column01"
                >
                  <option value="">カテゴリー</option>
                  <option value="column01">M&Aの基礎</option>
                  <option value="column02">事業承継</option>
                  <option value="column03">売却・譲渡</option>
                </select>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#333', marginBottom: 8 }}>タグ検索</div>
                {['M&A', '事業承継', '売却・譲渡', '中小企業', 'M&Aの基礎'].map(tag => (
                  <label key={tag} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#333', marginBottom: 6, cursor: 'pointer' }}>
                    <input type="checkbox" style={{ accentColor: '#97876A' }} readOnly />
                    {tag}
                  </label>
                ))}
                <button
                  type="button"
                  style={{
                    width: '100%',
                    marginTop: 12,
                    padding: '10px 0',
                    backgroundColor: '#97876A',
                    color: 'white',
                    border: 'none',
                    borderRadius: 4,
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  検索
                </button>
              </div>
            </div>
            {/* タグ一覧 */}
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#333', marginBottom: 12 }}>タグ一覧</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {[
                  { name: 'M&A', count: 5 },
                  { name: '事業承継', count: 4 },
                  { name: '売却・譲渡', count: 3 },
                  { name: '中小企業', count: 3 },
                  { name: 'M&Aの基礎', count: 2 },
                ].map(tag => (
                  <span
                    key={tag.name}
                    style={{
                      display: 'inline-block',
                      padding: '4px 10px',
                      borderRadius: 4,
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'white',
                      backgroundColor: '#97876A',
                      cursor: 'pointer',
                    }}
                  >
                    {tag.name} ({tag.count})
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* コンタクトセクション（c-contact 再現） */}
      <div style={{
        backgroundColor: '#FAF8F5',
        borderTop: '1px solid #E8E0D5',
        padding: '64px 40px',
        fontFamily: "'Yu Gothic','YuGothic',sans-serif",
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', textAlign: 'center' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#97876A', letterSpacing: '0.15em', marginBottom: 4, fontFamily: "'Yu Mincho','YuMincho',serif" }}>CONTACT</p>
          <h2 style={{ fontSize: 28, fontWeight: 700, color: '#222', fontFamily: "'Yu Mincho','YuMincho',serif", marginBottom: 8 }}>お問い合わせ</h2>
          <p style={{ fontSize: 13, color: '#808080', marginBottom: 8, letterSpacing: '0.03em', fontFamily: "'Yu Gothic','YuGothic',sans-serif" }}>Feel free to contact us.</p>
          <p style={{ fontSize: 14, color: '#333', lineHeight: 1.9, marginBottom: 40, fontFamily: "'Yu Mincho','YuMincho',serif" }}>
            当社は完全成功報酬ですので、ご相談は無料です。<br />
            M&amp;Aが最善の選択である場合のみご提案させていただきますので、<br />お気軽にご連絡ください。
          </p>
          {/* メインCTA（電話 + 問い合わせフォーム） */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 24,
            flexWrap: 'wrap',
            marginBottom: 24,
          }}>
            {/* 電話 + フォームボックス */}
            <div style={{
              backgroundColor: '#fff',
              border: '2px solid #E8E0D5',
              borderRadius: 4,
              padding: '28px 40px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
              minWidth: 280,
            }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#9b0000', letterSpacing: '0.08em', margin: 0, fontFamily: "'Yu Mincho','YuMincho',serif" }}>無料</p>
              <p style={{ fontSize: 13, color: '#333', fontWeight: 600, margin: 0, fontFamily: "'Yu Gothic','YuGothic',sans-serif" }}>お気軽にご相談ください</p>
              <a href="tel:03-6269-3040" style={{
                fontSize: 26,
                fontWeight: 900,
                color: '#222',
                textDecoration: 'none',
                fontFamily: "'Yu Mincho','YuMincho',serif",
                letterSpacing: '0.04em',
              }}>
                03-6269-3040
              </a>
              <p style={{ fontSize: 11, color: '#808080', margin: 0 }}>受付：平日 9:00〜18:00</p>
              <a
                href="https://ma-la.co.jp/inquiry/"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '12px 0',
                  backgroundColor: '#9b0000',
                  color: '#fff',
                  borderRadius: 4,
                  textDecoration: 'none',
                  fontSize: 14,
                  fontWeight: 700,
                  textAlign: 'center',
                  marginTop: 8,
                  fontFamily: "'Yu Gothic','YuGothic',sans-serif",
                }}
              >
                無料相談フォーム →
              </a>
            </div>
          </div>
          {/* サブCTA（資料DL + 株価算定） */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
            <a
              href="https://ma-la.co.jp/download/"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '12px 28px',
                backgroundColor: '#97876A',
                color: '#fff',
                borderRadius: 4,
                textDecoration: 'none',
                fontSize: 14,
                fontWeight: 700,
                fontFamily: "'Yu Gothic','YuGothic',sans-serif",
              }}
            >
              ↓ 資料ダウンロード
            </a>
            <a
              href="https://ma-la.co.jp/inquiry/stock-valuation/"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '12px 28px',
                backgroundColor: '#9b0000',
                color: '#fff',
                borderRadius: 4,
                textDecoration: 'none',
                fontSize: 14,
                fontWeight: 700,
                fontFamily: "'Yu Gothic','YuGothic',sans-serif",
              }}
            >
              株価算定サービス →
            </a>
          </div>
        </div>
      </div>

      {/* フッターナビ（l-fnav 再現） */}
      <div style={{
        backgroundColor: '#222222',
        color: 'white',
        padding: '48px 40px 32px',
        fontFamily: "'Yu Mincho','YuMincho',serif",
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          {/* ロゴ */}
          <div style={{ marginBottom: 32 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/ma-loyal-logo.png"
              alt="M&Aロイヤルアドバイザリー"
              style={{ height: 40, objectFit: 'contain', filter: 'brightness(0) invert(1)', opacity: 0.9 }}
            />
          </div>
          {/* ナビリスト */}
          <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap', marginBottom: 32 }}>
            {[
              { label: '当社のM&A仲介', subs: ['当社のビジョン', '選ばれる理由', 'コンサルタント紹介'] },
              { label: 'サービス紹介', subs: ['成果報酬体系', '譲渡・売却サービス', '譲受・買収サービス'] },
              { label: 'M&A成約実績', subs: ['M&A事例インタビュー', 'M&A事例一覧', 'M&A業界別事例'] },
              { label: 'M&A案件', subs: [] },
              { label: 'M&A情報', subs: ['M&Aとは', '事業承継とは', '業界別M&A'] },
              { label: '会社概要', subs: ['ご挨拶', '役員紹介', 'プレスリリース'] },
            ].map(nav => (
              <div key={nav.label} style={{ minWidth: 120 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 10, cursor: 'pointer' }}>{nav.label}</p>
                {nav.subs.map(sub => (
                  <p key={sub} style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 6, cursor: 'pointer' }}>{sub}</p>
                ))}
              </div>
            ))}
          </div>
          {/* M&A仲介協会 */}
          <div style={{
            borderTop: '1px solid rgba(255,255,255,0.15)',
            paddingTop: 24,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}>
            <div style={{ width: 2, height: 40, backgroundColor: '#97876A', flexShrink: 0 }} />
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
              M&amp;Aロイヤルアドバイザリーは、<br />
              一般社団法人 M&amp;A仲介協会の正会員です。
            </p>
          </div>
          {/* 個人情報 + セキュリティ */}
          <div style={{ marginTop: 20, display: 'flex', gap: 24, fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
            <span style={{ cursor: 'pointer' }}>個人情報保護について</span>
            <span style={{ cursor: 'pointer' }}>情報セキュリティ方針</span>
          </div>
        </div>
      </div>

      {/* フッター（l-footer 再現） */}
      <footer
        style={{
          backgroundColor: '#1a1a1a',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          padding: '16px 40px',
          fontFamily: "'Yu Gothic','YuGothic',sans-serif",
        }}
      >
        <div style={{ maxWidth: 1100, margin: '0 auto', textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: 0 }}>
            &copy; 2024 M&amp;A LOYAL ADVISORY Co.,Ltd
          </p>
        </div>
      </footer>
        </div>
        {!isPublishedPreview && (
          <div style={{ flexShrink: 0, width: 140, position: 'sticky', top: 72, paddingTop: 8 }}>
            <StepIndicator currentStep={4} onStepClick={handleStepClick} />
          </div>
        )}
      </div>
    </div>
  )
}

export default function PreviewPage() {
  return (
    <Suspense fallback={<PreviewLoading title="" />}>
      <PreviewContent />
    </Suspense>
  )
}
