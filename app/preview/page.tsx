'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useCallback, useMemo, useState, useEffect, Suspense } from 'react'
import StepIndicator from '@/components/editor/StepIndicator'
import type { Step } from '@/lib/types'
import { getSupervisorBlockHtml } from '@/lib/supervisorBlock'

const DUMMY_ARTICLES = [
  {
    imgSrc: '',
    category: 'M&Aの基礎',
    title: 'M&A成功のカギ！中小企業が知っておくべき事業承継の5つのポイント',
    href: 'https://ma-la.co.jp/m-and-a/',
  },
  {
    imgSrc: '',
    category: '売却・譲渡',
    title: '会社売却の流れをわかりやすく解説！M&Aの基本ステップと注意点',
    href: 'https://ma-la.co.jp/m-and-a/business-succession/',
  },
  {
    imgSrc: '',
    category: '事業承継',
    title: '事業承継とは？種類と流れ、メリット・デメリットをわかりやすく解説',
    href: 'https://ma-la.co.jp/m-and-a/business-succession/',
  },
]

const SUPERVISOR_FACE_IMAGE_URL = ''

// ─────────────────────────────────────────────
// CTAバナー（c-bnr-form 再現：本文中挿入用）
// ─────────────────────────────────────────────
function getPreviewCtaBannerHtml(): string {
  return `<div style="margin:56px 0;padding:32px 40px;background:#9b0000;border-radius:4px;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:20px;">
  <div style="position:relative;z-index:1;flex:1;min-width:240px;">
    <p style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.8);letter-spacing:0.15em;margin:0 0 8px;font-family:'Yu Gothic','YuGothic',sans-serif;">無料相談</p>
    <p style="font-size:24px;font-weight:900;color:#fff;margin:0 0 4px;font-family:'Yu Mincho','YuMincho',serif;line-height:1.4;">M&amp;Aの<span style="font-size:30px;">メリット・デメリット</span></p>
    <p style="font-size:19px;font-weight:700;color:#fff;margin:0;font-family:'Yu Mincho','YuMincho',serif;">私と話してみませんか？</p>
  </div>
  <a href="https://ma-la.co.jp/inquiry/" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:10px;padding:14px 32px;background:#97876A;color:#fff;border-radius:4px;text-decoration:none;font-weight:700;font-size:14px;font-family:'Yu Gothic','YuGothic',sans-serif;white-space:nowrap;flex-shrink:0;">橋場へのご相談はこちら <span style="font-size:18px;">→</span></a>
</div>`
}

function insertCtaBannersForPreview(html: string): string {
  const cta = getPreviewCtaBannerHtml()

  const matomeRegex = /<h2[^>]*>[^<]*まとめ[^<]*<\/h2>/gi
  const matomeMatch = matomeRegex.exec(html)
  if (matomeMatch) {
    return html.slice(0, matomeMatch.index) + cta + '\n' + html.slice(matomeMatch.index)
  }

  const h2Regex = /<h2[\s>]/gi
  let match: RegExpExecArray | null
  const positions: number[] = []
  while ((match = h2Regex.exec(html)) !== null) {
    positions.push(match.index)
  }
  if (positions.length >= 2) {
    const insertAt = positions[Math.floor(positions.length / 2)]!
    return html.slice(0, insertAt) + cta + '\n' + html.slice(insertAt)
  }

  return html + '\n' + cta
}

// ─────────────────────────────────────────────
// 目次生成
// ─────────────────────────────────────────────
interface TocEntry {
  id: string
  text: string
  level: 2 | 3
}

function buildTocHtml(entries: TocEntry[]): string {
  if (entries.length === 0) return ''
  const h2Items = entries.filter(e => e.level === 2)
  if (h2Items.length < 2) return ''

  let counter = 0
  const listItems = entries.map(entry => {
    if (entry.level === 2) {
      counter++
      return `<li style="margin-bottom:8px;"><a href="#${entry.id}" style="color:#9b0000;text-decoration:none;font-size:14px;font-weight:500;font-family:'Yu Gothic','YuGothic',sans-serif;line-height:1.6;">${counter}. ${entry.text}</a></li>`
    } else {
      return `<li style="margin:4px 0 4px 20px;"><a href="#${entry.id}" style="color:#9b0000;text-decoration:none;font-size:13px;font-family:'Yu Gothic','YuGothic',sans-serif;line-height:1.6;">${entry.text}</a></li>`
    }
  }).join('\n')

  return `<div id="ez-toc-container" style="background:#fff;border:1px solid #9b0000;border-radius:4px;padding:20px 24px 20px;margin:32px 0 40px;position:relative;">
  <div style="position:absolute;top:-11px;left:20px;background:#fff;padding:0 8px;">
    <p style="font-size:13px;font-weight:700;color:#9b0000;letter-spacing:0.05em;margin:0;font-family:'Yu Mincho','YuMincho',serif;">目次</p>
  </div>
  <nav>
    <ul style="list-style:none;padding:0;margin:8px 0 0;">
${listItems}
    </ul>
  </nav>
</div>`
}

// ─────────────────────────────────────────────
// 本文フォーマット（実サイト準拠）
// ─────────────────────────────────────────────
function formatContent(content: string): string {
  const supervisorBlock = getSupervisorBlockHtml(SUPERVISOR_FACE_IMAGE_URL)

  // 実サイト準拠スタイル
  const H2_STYLE = "font-size:22px;font-weight:700;margin:48px 0 20px;padding:16px 20px;background:#FAF8F5;color:#222;border-left:5px solid #9b0000;font-family:'Yu Mincho','YuMincho',serif;letter-spacing:0.02em;line-height:1.5;"
  const H3_STYLE = "font-size:18px;font-weight:700;margin:36px 0 14px;color:#222;padding-bottom:10px;border-bottom:2px solid #9b0000;font-family:'Yu Mincho','YuMincho',serif;letter-spacing:0.01em;"
  const H4_STYLE = "font-size:15px;font-weight:700;margin:28px 0 10px;color:#222;padding-left:12px;border-left:3px solid #97876A;font-family:'Yu Gothic','YuGothic',sans-serif;"
  const P_STYLE = "margin-bottom:1.7em;line-height:2.0;color:#333;"

  const applyInlineFormatting = (text: string): string =>
    text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/__([^_]+?)__/g, '$1')
      .replace(/(?<!\*)\*(?!\*)([^*]+?)(?<!\*)\*(?!\*)/g, '$1')
      .replace(/\*\*/g, '')

  const lines = content.split('\n')
  const htmlLines: string[] = []
  let currentParagraph: string[] = []
  const tocEntries: TocEntry[] = []
  let h2Counter = 0
  let h3Counter = 0

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

    // H2: 番号付き「1. 見出し」形式
    if (/^\d+[．.]\s/.test(trimmed) && currentParagraph.length === 0) {
      flushParagraph()
      const text = trimmed.replace(/^\d+[．.]\s*/, '').replace(/\*\*(.+?)\*\*/g, '$1')
      const id = `h2-${h2Counter++}`
      tocEntries.push({ id, text, level: 2 })
      htmlLines.push(`<h2 id="${id}" style="${H2_STYLE}">${applyInlineFormatting(text)}</h2>`)
      continue
    }

    // H3: 「1-1. 」形式
    if (/^\d+-\d+[．.]\s/.test(trimmed) && currentParagraph.length === 0) {
      flushParagraph()
      const text = trimmed.replace(/^\d+-\d+[．.]\s*/, '').replace(/\*\*(.+?)\*\*/g, '$1')
      const id = `h3-${h3Counter++}`
      tocEntries.push({ id, text, level: 3 })
      htmlLines.push(`<h3 id="${id}" style="${H3_STYLE}">${text}</h3>`)
      continue
    }

    // H3: 「■ ▶ ◆」等のアイコン付き
    if (/^[■▶◆●▼]\s/.test(trimmed)) {
      flushParagraph()
      const text = trimmed.replace(/^[■▶◆●▼]\s*/, '').replace(/\*\*(.+?)\*\*/g, '$1')
      const id = `h3-${h3Counter++}`
      tocEntries.push({ id, text, level: 3 })
      htmlLines.push(`<h3 id="${id}" style="${H3_STYLE}">${text}</h3>`)
      continue
    }

    // H4: 「Q.」「1-1-1.」等
    if (/^Q\.\s/.test(trimmed)) {
      flushParagraph()
      const text = trimmed.replace(/^Q\.\s*/, '')
      htmlLines.push(`<h4 style="${H4_STYLE}">Q. ${applyInlineFormatting(text)}</h4>`)
      continue
    }

    // 箇条書き「・」
    if (/^[・•]\s/.test(trimmed)) {
      flushParagraph()
      const text = trimmed.replace(/^[・•]\s*/, '').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      htmlLines.push(`<p style="margin-bottom:0.6em;padding-left:1.2em;text-indent:-1.2em;line-height:1.9;color:#333;">・${text}</p>`)
      continue
    }

    currentParagraph.push(trimmed)
  }

  flushParagraph()
  let bodyHtml = htmlLines.join('\n')

  // M&A LOYAL CTAリンク変換（実サイト準拠のアンカー色）
  bodyHtml = bodyHtml
    .replace(
      /M&amp;A成約実績はこちらから\s+https?:\/\/ma-la\.co\.jp\/result\/?/g,
      '<a href="https://ma-la.co.jp/result/" target="_blank" rel="noopener noreferrer" style="color:#9b0000;text-decoration:underline;font-weight:600;">M&amp;A成約実績はこちらから</a>'
    )
    .replace(
      /M&A成約実績はこちらから\s+https?:\/\/ma-la\.co\.jp\/result\/?/g,
      '<a href="https://ma-la.co.jp/result/" target="_blank" rel="noopener noreferrer" style="color:#9b0000;text-decoration:underline;font-weight:600;">M&amp;A成約実績はこちらから</a>'
    )
    .replace(
      /無料相談のお問い合わせはこちら\s+https?:\/\/ma-la\.co\.jp\/inquiry\/?/g,
      '<a href="https://ma-la.co.jp/inquiry/" target="_blank" rel="noopener noreferrer" style="color:#9b0000;text-decoration:underline;font-weight:600;">無料相談のお問い合わせはこちら</a>'
    )
    // 旧RAS URL残存対応
    .replace(
      /導入事例はこちらから\s+https?:\/\/[^\s<]*/g,
      '<a href="https://ma-la.co.jp/result/" target="_blank" rel="noopener noreferrer" style="color:#9b0000;text-decoration:underline;font-weight:600;">M&amp;A成約実績はこちらから</a>'
    )
    .replace(
      /お問い合わせはこちら\s+https?:\/\/[^\s<]*/g,
      '<a href="https://ma-la.co.jp/inquiry/" target="_blank" rel="noopener noreferrer" style="color:#9b0000;text-decoration:underline;font-weight:600;">無料相談のお問い合わせはこちら</a>'
    )

  // CTAバナー挿入
  bodyHtml = insertCtaBannersForPreview(bodyHtml)

  // 目次を最初の<p>直後に挿入
  const tocHtml = buildTocHtml(tocEntries)
  if (tocHtml) {
    const firstPMatch = bodyHtml.match(/<p style[^>]*>[\s\S]*?<\/p>/)
    if (firstPMatch && firstPMatch.index !== undefined) {
      const insertAt = firstPMatch.index + firstPMatch[0].length
      bodyHtml = bodyHtml.slice(0, insertAt) + '\n' + tocHtml + '\n' + bodyHtml.slice(insertAt)
    } else {
      bodyHtml = tocHtml + '\n' + bodyHtml
    }
  }

  return supervisorBlock + bodyHtml
}

// ─────────────────────────────────────────────
// ローディング画面
// ─────────────────────────────────────────────
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
        background: '#FAF8F5',
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
          background: 'linear-gradient(135deg, #9b0000, #97876A)',
          animation: 'rc-pulse 1.4s ease-in-out infinite',
          marginBottom: 28,
        }}
      />

      <p
        style={{
          fontSize: 15,
          fontWeight: 600,
          color: '#222222',
          fontFamily: "'Yu Mincho','YuMincho',serif",
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
          background: '#E8E0D5',
          overflow: 'hidden',
          marginBottom: 24,
        }}
      >
        <div
          style={{
            height: '100%',
            borderRadius: 2,
            background: 'linear-gradient(90deg, #9b0000, #97876A)',
            animation: 'rc-progress 1.8s ease-out forwards',
          }}
        />
      </div>

      {title && title !== '（タイトルなし）' && (
        <p
          style={{
            fontSize: 13,
            color: '#97876A',
            fontFamily: "'Yu Mincho','YuMincho',serif",
            maxWidth: 400,
            textAlign: 'center',
            lineHeight: 1.6,
            animation: 'rc-fade-in 0.7s ease-out 0.2s both',
            padding: '0 24px',
          }}
        >
          {title}
        </p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// メインプレビュー
// ─────────────────────────────────────────────
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
  const date = searchParams.get('date') || new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '.')
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
        .preview-body a { color: #9b0000; text-decoration: underline; }
        .preview-body a:hover { opacity: 0.75; }
        .preview-body strong { font-weight: 700; }
        .preview-body ul { padding-left: 1.4em; margin-bottom: 1.4em; }
        .preview-body li { margin-bottom: 0.4em; line-height: 1.9; }
        .preview-body table { border-collapse: collapse; width: 100%; margin-bottom: 1.6em; font-size: 14px; }
        .preview-body th, .preview-body td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
        .preview-body th { background: #9b0000; color: #fff; font-weight: 700; }
        .preview-body tr:nth-child(even) { background: #FAF8F5; }
      `}</style>

      {/* ══ 固定プレビューバー ══ */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 220,
          right: 0,
          zIndex: 1000,
          backgroundColor: '#222222',
          color: 'white',
          padding: '10px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>👁️</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>プレビューモード</div>
            <div style={{ fontSize: 11, opacity: 0.75 }}>
              {isPublishedPreview ? '投稿済み記事の表示確認' : '実際のサイトでの表示イメージを確認しています'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, flexShrink: 0, alignItems: 'center', flexWrap: 'wrap' }}>
          {isPublishedPreview ? (
            <>
              <button
                type="button"
                onClick={() => router.push('/published')}
                style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.5)', color: 'white', padding: '8px 18px', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
              >
                ← 一覧に戻る
              </button>
              {wordpressUrl && (
                <a
                  href={wordpressUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ backgroundColor: '#97876A', border: 'none', color: 'white', padding: '8px 20px', borderRadius: 6, fontWeight: 700, cursor: 'pointer', fontSize: 13, textDecoration: 'none', display: 'inline-block' }}
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
                style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.5)', color: 'white', padding: '8px 18px', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
              >
                ← 戻る
              </button>
              <button
                type="button"
                onClick={handlePublish}
                style={{ backgroundColor: '#97876A', border: 'none', color: 'white', padding: '8px 20px', borderRadius: 6, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}
              >
                投稿画面へ
              </button>
            </>
          )}
        </div>
      </div>

      {/* ══ メイン＋ステップインジケーター ══ */}
      <div style={{ paddingTop: 44, display: 'flex', gap: 0, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* ══ ヘッダー（l-header 再現） ══ */}
          <header
            style={{
              backgroundColor: '#ffffff',
              borderBottom: '1px solid #E8E0D5',
              position: 'sticky',
              top: 44,
              zIndex: 998,
            }}
          >
            {/* 上段：電話 + CTAボタン */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 10,
              padding: '8px 32px',
              borderBottom: '1px solid #F0EBE3',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginRight: 8 }}>
                <a href="tel:03-6269-3040" style={{
                  fontSize: 17,
                  fontWeight: 900,
                  color: '#222222',
                  textDecoration: 'none',
                  fontFamily: "'Yu Mincho','YuMincho',serif",
                  letterSpacing: '0.04em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                }}>
                  <svg width="11" height="15" fill="currentColor" viewBox="0 0 11 15"><path d="M2.404 9.364c2.594 4.948 5.507 5.453 6.354 5.009l.22-.116-1.983-3.783-.222.114c-.683.36-1.365-.676-2.239-2.342C3.661 6.58 3.196 5.43 3.88 5.072l.22-.117-1.984-3.782-.22.116c-.848.445-2.085 3.132.509 8.075zm7.775 4.264c.327-.172.147-.548-.04-.903l-1.332-2.54c-.143-.274-.38-.428-.57-.327-.12.063-.401.196-.762.375l1.98 3.774.724-.38zM5.313 4.286c.19-.1.198-.381.056-.657-.143-.276-1.332-2.54-1.332-2.54-.19-.355-.393-.717-.722-.545l-.724.38L4.571 4.7c.352-.196.62-.352.742-.414z"/></svg>
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
                  padding: '9px 16px',
                  borderRadius: 4,
                  fontSize: 13,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
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
                  padding: '9px 16px',
                  borderRadius: 4,
                  fontSize: 13,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
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
              minHeight: 54,
            }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/ma-loyal-logo.png"
                alt="M&Aロイヤルアドバイザリー"
                style={{ height: 32, objectFit: 'contain' }}
              />
              <nav style={{
                display: 'flex',
                gap: 20,
                fontSize: 13,
                color: '#222222',
                fontWeight: 500,
                whiteSpace: 'nowrap',
                fontFamily: "'Yu Mincho','YuMincho',serif",
              }}>
                {['当社のM&A仲介', 'サービス紹介', 'M&A成約実績', 'M&A案件', 'M&A情報', '会社概要', 'よくある質問'].map(item => (
                  <span key={item} style={{ cursor: 'pointer', padding: '14px 0', display: 'inline-block' }}>
                    {item}
                  </span>
                ))}
              </nav>
            </div>
          </header>

          {/* ══ FVバナー（p-sub-fv--02 再現：背景画像＋ダークオーバーレイ） ══ */}
          <section style={{
            position: 'relative',
            width: '100%',
            minHeight: 200,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/fv-bg.jpg"
              alt=""
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'center',
              }}
            />
            <div style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.62)',
            }} />
            <div style={{
              position: 'relative',
              zIndex: 1,
              maxWidth: 900,
              margin: '0 auto',
              padding: '48px 40px',
              textAlign: 'center',
            }}>
              <h1 style={{
                fontSize: 26,
                fontWeight: 700,
                color: '#ffffff',
                fontFamily: "'Yu Mincho','YuMincho',serif",
                letterSpacing: '0.04em',
                lineHeight: 1.7,
                margin: 0,
              }}>
                {title}
              </h1>
            </div>
          </section>

          {/* ══ CTAバナー帯（c-bnr 再現） ══ */}
          <div style={{
            backgroundColor: '#FAF8F5',
            borderBottom: '1px solid #E8E0D5',
            padding: '14px 40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
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
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <a
                href="https://ma-la.co.jp/inquiry/sellside/"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 20px',
                  backgroundColor: '#9b0000',
                  color: '#fff',
                  borderRadius: 4,
                  textDecoration: 'none',
                  fontSize: 13,
                  fontWeight: 700,
                  fontFamily: "'Yu Gothic','YuGothic',sans-serif",
                  lineHeight: 1.4,
                  textAlign: 'center' as const,
                }}
              >
                <span>譲渡・売却・事業承継<br /><span style={{ fontSize: 11 }}>無料相談のご案内</span></span>
                <span style={{ fontSize: 14 }}>→</span>
              </a>
              <a
                href="https://ma-la.co.jp/inquiry/buyside/"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 20px',
                  backgroundColor: '#97876A',
                  color: '#fff',
                  borderRadius: 4,
                  textDecoration: 'none',
                  fontSize: 13,
                  fontWeight: 700,
                  fontFamily: "'Yu Gothic','YuGothic',sans-serif",
                  lineHeight: 1.4,
                  textAlign: 'center' as const,
                }}
              >
                <span>譲受・買収・成長戦略<br /><span style={{ fontSize: 11 }}>無料相談のご案内</span></span>
                <span style={{ fontSize: 14 }}>→</span>
              </a>
            </div>
          </div>

          {/* ══ p-single コンテンツエリア ══ */}
          <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 32px' }}>

            {/* パンくずリスト（p-single__breadcrumb 再現） */}
            <nav
              style={{ fontSize: 12, color: '#808080', fontFamily: "'Yu Mincho','YuMincho',serif", padding: '14px 0', borderBottom: '1px solid #F0EBE3', marginBottom: 40 }}
              aria-label="パンくず"
            >
              <a href="https://ma-la.co.jp" style={{ color: '#9b0000', textDecoration: 'none', cursor: 'pointer' }}>HOME</a>
              <span style={{ margin: '0 6px' }}>&gt;</span>
              <a href="https://ma-la.co.jp/m-and-a/" style={{ color: '#9b0000', textDecoration: 'none', cursor: 'pointer' }}>M&amp;Aとは</a>
              <span style={{ margin: '0 6px' }}>&gt;</span>
              <a href="https://ma-la.co.jp/m-and-a/all-articles/" style={{ color: '#9b0000', textDecoration: 'none', cursor: 'pointer' }}>M&amp;A記事一覧</a>
              <span style={{ margin: '0 6px' }}>&gt;</span>
              <span>{title.length > 40 ? `${title.slice(0, 40)}...` : title}</span>
            </nav>

            {/* 1カラム：記事本文エリア（maxWidth 840px 中央寄せ） */}
            <div style={{ maxWidth: 840, margin: '0 auto', paddingBottom: 80 }}>

              {/* 記事ヘッダー：日付のみ（タイトルはFVに表示済み） */}
              <div style={{ marginBottom: 24 }}>
                <time style={{
                  color: '#808080',
                  fontSize: 13,
                  fontFamily: "'Yu Gothic','YuGothic',sans-serif",
                  display: 'block',
                  marginBottom: 24,
                }}>
                  {date}
                </time>

                {/* アイキャッチ画像 */}
                {imageUrl && (
                  <div style={{ marginBottom: 40 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageUrl}
                      alt=""
                      style={{
                        width: '100%',
                        height: 'auto',
                        display: 'block',
                        borderRadius: 4,
                        boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
                      }}
                    />
                  </div>
                )}
              </div>

              {/* 記事本文（p-single__content 再現） */}
              <div
                className="preview-body"
                style={{
                  fontFamily: "'Yu Gothic','YuGothic','Noto Sans JP',sans-serif",
                  fontSize: 15,
                  lineHeight: 2.0,
                  color: '#333',
                }}
                dangerouslySetInnerHTML={{ __html: formattedContent }}
              />
            </div>
          </div>

          {/* ══ 関連記事セクション（p-ma-related 再現） ══ */}
          <div style={{
            backgroundColor: '#FAF8F5',
            borderTop: '1px solid #E8E0D5',
            padding: '64px 32px',
          }}>
            <div style={{ maxWidth: 1100, margin: '0 auto' }}>
              <p style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#97876A',
                letterSpacing: '0.15em',
                marginBottom: 8,
                fontFamily: "'Yu Mincho','YuMincho',serif",
              }}>
                RELATED ARTICLES
              </p>
              <h2 style={{
                fontSize: 24,
                fontWeight: 700,
                color: '#222',
                fontFamily: "'Yu Mincho','YuMincho',serif",
                marginBottom: 8,
                letterSpacing: '0.04em',
              }}>
                関連記事のご案内
              </h2>
              <p style={{
                fontSize: 13,
                color: '#808080',
                fontFamily: "'Yu Gothic','YuGothic',sans-serif",
                marginBottom: 32,
              }}>
                M&amp;Aロイヤルアドバイザリーでご用意している関連記事をご紹介いたします。
              </p>

              {/* 記事カードグリッド */}
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                {DUMMY_ARTICLES.map((article, i) => (
                  <a
                    key={i}
                    href={article.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      flex: '1 1 260px',
                      maxWidth: 320,
                      backgroundColor: 'white',
                      borderRadius: 4,
                      overflow: 'hidden',
                      border: '1px solid #E8E0D5',
                      textDecoration: 'none',
                      display: 'block',
                    }}
                  >
                    {/* サムネイル */}
                    <div style={{
                      width: '100%',
                      aspectRatio: '16/9',
                      backgroundColor: '#222222',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 16,
                    }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="/ma-loyal-logo.png"
                        alt=""
                        style={{ height: 28, objectFit: 'contain', opacity: 0.9, mixBlendMode: 'screen' }}
                      />
                    </div>
                    <div style={{ padding: '12px 16px 16px' }}>
                      <span style={{ fontSize: 11, color: '#97876A', fontWeight: 700, fontFamily: "'Yu Gothic','YuGothic',sans-serif" }}>
                        {article.category}
                      </span>
                      <p style={{ fontWeight: 700, fontSize: 13, lineHeight: 1.6, color: '#111', marginTop: 6, fontFamily: "'Yu Mincho','YuMincho',serif" }}>
                        {article.title}
                      </p>
                      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 12, color: '#9b0000', fontWeight: 700, fontFamily: "'Yu Gothic','YuGothic',sans-serif" }}>
                          詳細を見る
                        </span>
                        <span style={{ fontSize: 12, color: '#9b0000' }}>→</span>
                      </div>
                    </div>
                  </a>
                ))}
              </div>

              {/* M&A記事一覧ボタン */}
              <div style={{ textAlign: 'center', marginTop: 40 }}>
                <a
                  href="https://ma-la.co.jp/m-and-a/all-articles/"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '14px 44px',
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
                  M&amp;A記事一覧へ <span>→</span>
                </a>
              </div>
            </div>
          </div>

          {/* ══ コンタクトセクション（c-contact 再現） ══ */}
          <div style={{
            backgroundColor: '#ffffff',
            borderTop: '1px solid #E8E0D5',
            padding: '72px 40px',
            fontFamily: "'Yu Gothic','YuGothic',sans-serif",
          }}>
            <div style={{ maxWidth: 1100, margin: '0 auto', textAlign: 'center' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#97876A', letterSpacing: '0.15em', marginBottom: 4, fontFamily: "'Yu Mincho','YuMincho',serif" }}>CONTACT</p>
              <h2 style={{ fontSize: 28, fontWeight: 700, color: '#222', fontFamily: "'Yu Mincho','YuMincho',serif", marginBottom: 8, letterSpacing: '0.03em' }}>お問い合わせ</h2>
              <p style={{ fontSize: 13, color: '#808080', marginBottom: 8, letterSpacing: '0.03em', fontFamily: "'Yu Gothic','YuGothic',sans-serif" }}>Feel free to contact us.</p>
              <p style={{ fontSize: 14, color: '#333', lineHeight: 2.0, marginBottom: 48, fontFamily: "'Yu Mincho','YuMincho',serif" }}>
                当社は完全成功報酬ですので、ご相談は無料です。<br />
                M&amp;Aが最善の選択である場合のみご提案させていただきますので、<br />お気軽にご連絡ください。
              </p>

              {/* メインCTA */}
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 32,
                backgroundColor: '#fff',
                border: '2px solid #E8E0D5',
                borderRadius: 4,
                padding: '28px 40px',
                marginBottom: 24,
                flexWrap: 'wrap',
                justifyContent: 'center',
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#9b0000', letterSpacing: '0.08em', fontFamily: "'Yu Mincho','YuMincho',serif" }}>無料</span>
                  <span style={{ fontSize: 13, color: '#333', fontWeight: 600, fontFamily: "'Yu Gothic','YuGothic',sans-serif" }}>お気軽にご相談ください</span>
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
                  <span style={{ fontSize: 11, color: '#808080' }}>受付：平日 9:00〜18:00</span>
                </div>
                <a
                  href="https://ma-la.co.jp/inquiry/"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'block',
                    padding: '14px 36px',
                    backgroundColor: '#9b0000',
                    color: '#fff',
                    borderRadius: 4,
                    textDecoration: 'none',
                    fontSize: 15,
                    fontWeight: 700,
                    fontFamily: "'Yu Gothic','YuGothic',sans-serif",
                  }}
                >
                  無料相談フォーム →
                </a>
              </div>

              {/* サブCTA */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
                <a
                  href="https://ma-la.co.jp/download/"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 28px',
                    backgroundColor: '#97876A', color: '#fff', borderRadius: 4,
                    textDecoration: 'none', fontSize: 14, fontWeight: 700,
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
                    display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 28px',
                    backgroundColor: '#9b0000', color: '#fff', borderRadius: 4,
                    textDecoration: 'none', fontSize: 14, fontWeight: 700,
                    fontFamily: "'Yu Gothic','YuGothic',sans-serif",
                  }}
                >
                  株価算定サービス →
                </a>
              </div>
            </div>
          </div>

          {/* ══ フッターナビ（l-fnav 再現） ══ */}
          <div style={{
            backgroundColor: '#222222',
            color: 'white',
            padding: '48px 40px 32px',
            fontFamily: "'Yu Mincho','YuMincho',serif",
          }}>
            <div style={{ maxWidth: 1100, margin: '0 auto' }}>
              {/* ロゴ */}
              <div style={{ marginBottom: 36 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/ma-loyal-logo.png"
                  alt="M&Aロイヤルアドバイザリー"
                  style={{ height: 36, objectFit: 'contain', mixBlendMode: 'screen', opacity: 0.9 }}
                />
              </div>
              {/* ナビリスト */}
              <div style={{ display: 'flex', gap: 36, flexWrap: 'wrap', marginBottom: 32 }}>
                {[
                  { label: '当社のM&A仲介', subs: ['当社のビジョン', '選ばれる理由', 'コンサルタント紹介'] },
                  { label: 'サービス紹介', subs: ['成果報酬体系', '譲渡・売却サービス', '譲受・買収サービス'] },
                  { label: 'M&A成約実績', subs: ['M&A事例インタビュー', 'M&A事例一覧', 'M&A業界別事例'] },
                  { label: 'M&A案件', subs: [] },
                  { label: 'M&A情報', subs: ['M&Aとは', '事業承継とは', '業界別M&A'] },
                  { label: '会社概要', subs: ['ご挨拶', '役員紹介', 'プレスリリース'] },
                ].map(nav => (
                  <div key={nav.label} style={{ minWidth: 110 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 10, cursor: 'pointer' }}>{nav.label}</p>
                    {nav.subs.map(sub => (
                      <p key={sub} style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginBottom: 6, cursor: 'pointer' }}>{sub}</p>
                    ))}
                  </div>
                ))}
              </div>
              {/* M&A仲介協会 */}
              <div style={{
                borderTop: '1px solid rgba(255,255,255,0.12)',
                paddingTop: 24,
                display: 'flex',
                alignItems: 'center',
                gap: 16,
              }}>
                <div style={{ width: 2, height: 40, backgroundColor: '#97876A', flexShrink: 0 }} />
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.7 }}>
                  M&amp;Aロイヤルアドバイザリーは、<br />
                  一般社団法人 M&amp;A仲介協会の正会員です。
                </p>
              </div>
              {/* 個人情報 + セキュリティ */}
              <div style={{ marginTop: 20, display: 'flex', gap: 24, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                <span style={{ cursor: 'pointer' }}>個人情報保護について</span>
                <span style={{ cursor: 'pointer' }}>情報セキュリティ方針</span>
              </div>
            </div>
          </div>

          {/* ══ フッター ══ */}
          <footer
            style={{
              backgroundColor: '#1a1a1a',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              padding: '16px 40px',
              fontFamily: "'Yu Gothic','YuGothic',sans-serif",
            }}
          >
            <div style={{ maxWidth: 1100, margin: '0 auto', textAlign: 'center' }}>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', margin: 0 }}>
                &copy; 2024 M&amp;A LOYAL ADVISORY Co.,Ltd
              </p>
            </div>
          </footer>

        </div>

        {/* ステップインジケーター（右端固定） */}
        {!isPublishedPreview && (
          <div style={{ flexShrink: 0, width: 140, position: 'sticky', top: 56, paddingTop: 8 }}>
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
