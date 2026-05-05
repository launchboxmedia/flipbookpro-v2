import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { paginateText } from '@/lib/paginateText'
import { detectAcronymBlock } from '@/lib/acronymBlock'
import type { FrameworkData } from '@/types/database'

export async function GET(_req: NextRequest, { params }: { params: { bookId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: book } = await supabase
    .from('books')
    .select('*')
    .eq('id', params.bookId)
    .eq('user_id', user.id)
    .single()

  if (!book) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [{ data: pages }, { data: profile }] = await Promise.all([
    supabase
      .from('book_pages')
      .select('*')
      .eq('book_id', params.bookId)
      .order('chapter_index', { ascending: true }),
    // Profile is needed for the interior title + copyright pages — pulls
    // the author name and the publisher imprint (full_name on the brand
    // profile, fallback to LaunchBox.Media).
    supabase.from('profiles').select('full_name, logo_url').eq('id', user.id).maybeSingle(),
  ])

  const allChapters = (pages ?? []).filter((p) => p.chapter_index >= 0)
  const backMatter = (pages ?? []).filter((p) => p.chapter_index < 0 && p.content)

  // Pull a front-matter "Introduction"/"Preface"/"Foreword" chapter out of
  // the regular sequence so it doesn't render twice.
  const isIntroChapter = (ch: typeof allChapters[number]) =>
    /^(introduction|preface|foreword)\b/i.test((ch.chapter_title ?? '').trim())
  const introChapter = allChapters[0] && isIntroChapter(allChapters[0]) ? allChapters[0] : null
  const chapters = introChapter ? allChapters.slice(1) : allChapters

  // Introduction content is rendered ONLY when the book has an explicit
  // Introduction/Preface/Foreword chapter. Never auto-promote chapter 1 as
  // a "teaser" — that broke the spread sequence by surfacing chapter
  // content before the TOC.
  const introContent = introChapter ? (introChapter.content ?? '') : ''
  const introTitle = introChapter?.chapter_title ?? null

  // Imprint resolution mirrors the FlipbookViewer's resolveImprint().
  const imprint = profile?.full_name?.trim() || 'LaunchBox.Media'
  const author = book.author_name || profile?.full_name || 'Author'
  const bookYear = (() => {
    const created = book.created_at ? new Date(book.created_at) : null
    if (created && !Number.isNaN(created.getTime())) return created.getFullYear()
    return new Date().getFullYear()
  })()

  const fontSpec = (() => {
    switch (book.typography) {
      case 'executive_serif':
        return { google: 'Source+Serif+4:ital,wght@0,400;0,600;1,400', css: "'Source Serif 4', Georgia, serif" }
      case 'editorial_classic':
      case 'bold_display':
        return { google: 'Playfair+Display:ital,wght@0,400;0,700;1,400', css: "'Playfair Display', Georgia, serif" }
      default:
        return { google: 'Inter:wght@400;500', css: "'Inter', system-ui, sans-serif" }
    }
  })()

  // Front-matter spread 1 — interior title page. Cream surface, all text
  // ink-1, centered. Mirrors the FlipbookViewer's InteriorTitlePage layout.
  const interiorTitleHtml = `
    <section class="front-title page-break">
      <div class="front-spacer"></div>
      <div class="front-title-block">
        <h1 class="front-title-heading">${esc(book.title || 'Untitled')}</h1>
        ${book.subtitle ? `<p class="front-title-subtitle">${esc(book.subtitle)}</p>` : ''}
        <div class="front-title-rule"></div>
        ${author ? `<p class="front-title-author">${esc(author)}</p>` : ''}
      </div>
      <p class="front-title-imprint">${esc(imprint)}</p>
    </section>
  `

  // Front-matter spread 2 — copyright. Sections separated by an em-dash rule.
  const copyrightHtml = `
    <section class="copyright page-break">
      <div class="copyright-block">
        <p class="copyright-imprint">${esc(imprint)}</p>
        <span class="copyright-rule" aria-hidden="true">—</span>
        <p class="copyright-line">An Imprint of FlipBookPro</p>
        <span class="copyright-rule" aria-hidden="true">—</span>
        <p class="copyright-line">Copyright © ${bookYear} ${esc(author)}</p>
        <span class="copyright-rule" aria-hidden="true">—</span>
        <p class="copyright-line">All rights reserved including the right to reproduce this book or portions thereof in any form whatsoever.</p>
        <span class="copyright-rule" aria-hidden="true">—</span>
        <p class="copyright-line">Generated with AI assistance by FlipBookPro — LaunchBox.Media</p>
        <span class="copyright-rule" aria-hidden="true">—</span>
        <p class="copyright-line">First FlipBookPro edition ${bookYear}</p>
      </div>
    </section>
  `

  // Front-matter — introduction section, only emitted when an actual intro
  // chapter exists. Otherwise the export skips straight from copyright to TOC.
  const introChunks = introContent.trim() ? paginateText(introContent) : []
  const introductionHtml = introChunks.length > 0
    ? introChunks.map((chunk, k) => `
        <section class="introduction page-break">
          ${k === 0 ? `
            <div class="chapter-header">
              <span class="chapter-label">${esc(introTitle ?? 'Begin')}</span>
              <div class="gold-rule"></div>
            </div>
          ` : `
            <div class="chapter-cont-header">
              <span class="chapter-cont-label">${esc(introTitle ?? 'Begin')}</span>
              <span class="chapter-cont-page">${k + 1} / ${introChunks.length}</span>
            </div>
          `}
          <div class="chapter-body">${paragraphs(chunk)}</div>
        </section>
      `).join('')
    : ''

  const tocHtml = chapters.length > 0 ? `
    <section class="toc page-break">
      <h2 class="toc-heading">Contents</h2>
      <div class="gold-rule"></div>
      <ol class="toc-list">
        ${chapters.map((ch, i) => `
          <li>
            <span class="toc-num">${i + 1}</span>
            <span class="toc-text">${esc(ch.chapter_title)}</span>
          </li>
        `).join('')}
      </ol>
    </section>
  ` : ''

  // Apply the same sentence-aware pagination as the flipbook viewer so the
  // export visually matches "page-by-page" structure. Each chunk becomes its
  // own <section>. A `page-break` between chapters; chunks of the SAME chapter
  // flow continuously on screen but break onto separate pages when printed
  // (page-break-inside: avoid would be too aggressive — let the print engine
  // decide). Every word of the chapter is emitted across the chunks; no text
  // is dropped.
  // Map chapter_index → framework letter for the decorative overlay
  // (matches the FlipbookViewer's behavior).
  const framework = (book.framework_data ?? null) as FrameworkData | null
  const letterByChapterIndex = new Map<number, string>()
  if (framework?.steps) {
    for (const step of framework.steps) {
      if (typeof step.chapter_index === 'number' && step.letter) {
        letterByChapterIndex.set(step.chapter_index, step.letter.toUpperCase())
      }
    }
  }

  const chaptersHtml = chapters.map((ch, i) => {
    const chunks = paginateText(ch.content ?? '')
    const frameworkLetter = letterByChapterIndex.get(ch.chapter_index)
    // Pull-quote block — appended after the LAST chunk of the chapter so
    // it sits at the natural end of the chapter flow. NULL pull_quote means
    // skip the block entirely (no facing-page concern in the linear HTML
    // export, unlike the flipbook viewer).
    const pullQuote = ch.pull_quote?.trim() || ''
    const pullQuoteBlock = pullQuote
      ? `
          <div class="pull-quote-block">
            <div class="pull-quote-rule"></div>
            <blockquote class="pull-quote-text">${esc(pullQuote)}</blockquote>
            <div class="pull-quote-rule"></div>
          </div>
        `
      : ''
    return chunks.map((chunk, k) => {
      const isFirst = k === 0
      const isLast = k === chunks.length - 1
      // Framework letter (e.g. "C" for chapter 3 of CREDIT) overlaid in the
      // top-right of the chapter opener.
      const letterOverlay = isFirst && frameworkLetter
        ? `<span class="framework-letter" aria-hidden="true">${esc(frameworkLetter)}</span>`
        : ''
      const header = isFirst
        ? `<div class="chapter-header${frameworkLetter ? ' has-framework-letter' : ''}">
             <span class="chapter-label">Chapter ${i + 1}</span>
             <h2 class="chapter-title">${esc(ch.chapter_title)}</h2>
             <div class="gold-rule"></div>
           </div>`
        : `<div class="chapter-cont-header">
             <span class="chapter-cont-label">Chapter ${i + 1}</span>
             <span class="chapter-cont-title">${esc(ch.chapter_title)}</span>
             <span class="chapter-cont-page">${k + 1} / ${chunks.length}</span>
           </div>`
      const image = isFirst && ch.image_url
        ? `<img src="${esc(ch.image_url)}" alt="" class="chapter-image" />`
        : ''
      // First chunk of each chapter starts a new printed page; continuation
      // chunks of the SAME chapter break too so each chunk = one page in
      // print, mirroring the flipbook spread layout.
      const sectionClass = `chapter${isFirst ? ' page-break-chapter' : ' page-break-cont'}`
      return `
        <section class="${sectionClass}">
          ${letterOverlay}
          ${header}
          ${image}
          <div class="chapter-body">${paragraphs(chunk)}</div>
          ${isLast ? pullQuoteBlock : ''}
        </section>
      `
    }).join('')
  }).join('')

  const backMatterHtml = backMatter.map((bm) => `
    <section class="chapter page-break">
      <div class="chapter-header">
        <h2 class="chapter-title">${esc(bm.chapter_title)}</h2>
        <div class="gold-rule"></div>
      </div>
      <div class="chapter-body">${paragraphs(bm.content ?? '')}</div>
    </section>
  `).join('')

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(book.title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="https://fonts.googleapis.com/css2?family=${fontSpec.google}&family=Playfair+Display:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet" />
<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: ${fontSpec.css};
  background: #FAF7F2;
  color: #1A1A1A;
  line-height: 1.75;
  font-size: 17px;
}

.cover {
  min-height: 100vh;
  background: #111;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 5rem 3rem;
  position: relative;
}
.cover::before, .cover::after {
  content: '';
  position: absolute;
  left: 3rem; right: 3rem;
  height: 1px;
  background: rgba(201,168,76,0.35);
}
.cover::before { top: 3rem; }
.cover::after  { bottom: 3rem; }

.cover-bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: 0;
}
/* Default behavior — image sits behind a dark scrim so the overlay text
   stays legible. */
.cover-bg-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.78) 100%);
  z-index: 1;
}
.cover-content { position: relative; z-index: 2; }
/* When the uploaded image already has its own title/author baked in,
   we drop the scrim and the overlay text. */
.cover.cover-image-only .cover-bg { z-index: 0; }
.cover.cover-image-only .cover-bg-overlay,
.cover.cover-image-only .cover-content { display: none; }

.cover-title {
  font-family: 'Playfair Display', Georgia, serif;
  font-size: clamp(2rem, 5vw, 3rem);
  color: #F5F0E8;
  line-height: 1.15;
  margin-bottom: 1rem;
}
.cover-subtitle {
  font-size: 1.1rem;
  color: #C9A84C;
  font-style: italic;
  margin-bottom: 2rem;
}
.cover-divider { width: 2.5rem; height: 1px; background: rgba(201,168,76,0.5); margin: 0 auto 1.5rem; }
.cover-author { font-family: 'Inter', sans-serif; font-size: 0.75rem; color: #666; letter-spacing: 0.15em; text-transform: uppercase; }

.page-break { page-break-before: always; }

.toc {
  max-width: 640px;
  margin: 0 auto;
  padding: 6rem 2rem;
}
.toc-heading {
  font-family: 'Playfair Display', Georgia, serif;
  font-size: 2rem;
  margin-bottom: 1rem;
}
.gold-rule { width: 2.5rem; height: 2px; background: #C9A84C; margin-bottom: 2rem; }
.toc-list { list-style: none; }
.toc-list li { display: flex; gap: 1rem; padding: 0.55rem 0; border-bottom: 1px solid rgba(0,0,0,0.07); font-size: 0.95rem; }
.toc-num { color: #C9A84C; min-width: 1.5rem; font-family: 'Inter', sans-serif; font-size: 0.8rem; padding-top: 0.1em; }

/* ── Front matter — interior title page ───────────────────────────────── */
.front-title {
  max-width: 540px;
  margin: 0 auto;
  padding: 6rem 2rem 4rem;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  background: #FAF7F2;
  color: #1A1A1A;
}
.front-spacer { flex: 1; }
.front-title-block { display: flex; flex-direction: column; align-items: center; gap: 1.1rem; max-width: 28rem; }
.front-title-heading {
  font-family: 'Playfair Display', Georgia, serif;
  font-size: clamp(1.9rem, 4vw, 2.6rem);
  font-weight: 700;
  line-height: 1.15;
  margin: 0;
  letter-spacing: -0.005em;
}
.front-title-subtitle {
  font-family: ${fontSpec.css};
  font-size: 1rem;
  font-style: italic;
  color: rgba(26,26,26,0.7);
  margin: 0;
}
.front-title-rule { width: 2.5rem; height: 1px; background: #C9A84C; margin: 0.5rem 0; }
.front-title-author {
  font-family: 'Inter', sans-serif;
  font-size: 0.7rem;
  font-variant: small-caps;
  letter-spacing: 0.18em;
  margin: 0;
}
.front-title-imprint {
  flex: 0 0 auto;
  margin-top: auto;
  font-family: 'Inter', sans-serif;
  font-size: 0.65rem;
  color: rgba(26,26,26,0.5);
  font-variant: small-caps;
  letter-spacing: 0.18em;
}

/* ── Front matter — copyright page ────────────────────────────────────── */
.copyright {
  max-width: 540px;
  margin: 0 auto;
  padding: 6rem 2rem 4rem;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #FAF7F2;
  color: #1A1A1A;
}
.copyright-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  max-width: 22rem;
}
.copyright-imprint {
  font-family: 'Source Serif 4', Georgia, serif;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  margin: 0;
  opacity: 0.95;
}
.copyright-line {
  font-family: 'Source Serif 4', Georgia, serif;
  font-size: 10px;
  line-height: 1.55;
  margin: 0;
  opacity: 0.78;
}
.copyright-rule {
  font-family: 'Source Serif 4', Georgia, serif;
  font-size: 10px;
  margin: 0.7rem 0;
  opacity: 0.35;
  line-height: 1;
}

/* ── Front matter — introduction (chapter-styled but pulled forward) ─── */
.introduction {
  max-width: 640px;
  margin: 0 auto;
  padding: 4rem 2rem;
}
.introduction.page-break { padding-top: 6rem; }
.introduction .chapter-header,
.introduction .chapter-cont-header { margin-bottom: 2rem; }

.chapter {
  max-width: 640px;
  margin: 0 auto;
  padding: 4rem 2rem;
}
.chapter.page-break-chapter { padding-top: 6rem; }
.chapter-header { margin-bottom: 2.5rem; }
.chapter-label { font-family: 'Inter', sans-serif; font-size: 0.7rem; letter-spacing: 0.15em; text-transform: uppercase; color: #C9A84C; display: block; margin-bottom: 0.5rem; }
.chapter-title { font-family: 'Playfair Display', Georgia, serif; font-size: 1.9rem; line-height: 1.2; margin-bottom: 1rem; }
.chapter-image { width: 100%; max-height: 260px; object-fit: cover; border-radius: 4px; margin-bottom: 2rem; }
.chapter-body p { margin-bottom: 1.3em; }
.chapter-body p:last-child { margin-bottom: 0; }

/* Pull quote — appended after each chapter's body when pull_quote exists.
   Two thin gold rules bracketing a centred italic Playfair line. Only
   rendered when the LAST chunk of a chapter emits the block. */
.pull-quote-block { margin: 2.5rem auto; max-width: 75%; text-align: center; }
.pull-quote-rule { width: 4rem; height: 1px; background-color: #C9A84C; margin: 0 auto 1.25rem; }
.pull-quote-block .pull-quote-rule:last-child { margin: 1.25rem auto 0; }
.pull-quote-text { font-family: 'Playfair Display', Georgia, serif; font-style: italic; font-size: 1.2rem; line-height: 1.7; color: #1C2333; margin: 0; padding: 0; }

/* Acronym block — rendered when a paragraph is a series of "L — definition"
   lines (e.g. the C.R.E.D.I.T. framework breakdown). */
.acronym-block {
  display: flex;
  flex-direction: column;
  gap: 0.6em;
  margin: 0.4em 0 1.6em;
}
.acronym-row {
  display: flex;
  align-items: baseline;
  gap: 1.1em;
}
.acronym-letter {
  font-family: 'Playfair Display', Georgia, serif;
  font-weight: 700;
  font-size: 2.4rem;
  color: #C9A84C;
  line-height: 1;
  width: 1.1em;
  flex-shrink: 0;
  text-align: center;
}
.acronym-def {
  font-family: 'Source Serif 4', Georgia, serif;
  font-size: 1rem;
  line-height: 1.45;
}

/* Framework letter overlay — large gold Playfair character in the top-right
   corner of the chapter opener, partially overlapping the chapter title. */
.chapter { position: relative; }
.framework-letter {
  position: absolute;
  top: 3rem;
  right: 1.5rem;
  font-family: 'Playfair Display', Georgia, serif;
  font-weight: 700;
  font-size: 6rem;
  color: #C9A84C;
  opacity: 0.85;
  line-height: 1;
  pointer-events: none;
  z-index: 1;
}
.chapter-header.has-framework-letter .chapter-title { padding-right: 4rem; }

/* Continuation header — small, italic title, "2 / 3" page indicator. Used
   on every chapter chunk after the first so the reader keeps context. */
.chapter-cont-header {
  display: flex;
  align-items: baseline;
  gap: 1rem;
  margin-bottom: 2rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid rgba(0,0,0,0.08);
  font-size: 0.85rem;
}
.chapter-cont-label {
  font-family: 'Inter', sans-serif;
  font-size: 0.7rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: #C9A84C;
}
.chapter-cont-title {
  font-family: 'Playfair Display', Georgia, serif;
  font-style: italic;
  flex: 1;
  color: rgba(26,26,26,0.6);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.chapter-cont-page {
  font-family: 'Inter', sans-serif;
  font-size: 0.7rem;
  color: rgba(26,26,26,0.5);
  font-variant-numeric: tabular-nums;
}

@media print {
  body { background: white; font-size: 12pt; }
  .cover { min-height: 100vh; }
  /* Both chapter starts and continuation chunks force a print page break,
     so each chunk in the export occupies its own printed page — matching
     the flipbook's one-spread-per-chunk model. */
  .page-break,
  .page-break-chapter,
  .page-break-cont { page-break-before: always; }
}

@media (max-width: 600px) {
  .cover, .toc, .chapter { padding-left: 1.5rem; padding-right: 1.5rem; }
}
</style>
</head>
<body>

<section class="cover${book.cover_has_text && book.cover_image_url ? ' cover-image-only' : ''}">
  ${book.cover_image_url ? `
    <img src="${esc(book.cover_image_url)}" alt="" class="cover-bg" />
    <div class="cover-bg-overlay"></div>
  ` : ''}
  <div class="cover-content">
    <h1 class="cover-title">${esc(book.title)}</h1>
    ${book.subtitle ? `<p class="cover-subtitle">${esc(book.subtitle)}</p>` : ''}
    ${book.author_name ? `<div class="cover-divider"></div><p class="cover-author">${esc(book.author_name)}</p>` : ''}
  </div>
</section>

${interiorTitleHtml}
${copyrightHtml}
${introductionHtml}
${tocHtml}
${chaptersHtml}
${backMatterHtml}

</body>
</html>`

  const filename = book.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') + '.html'

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function paragraphs(content: string): string {
  return content
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const acronym = detectAcronymBlock(p)
      if (acronym) {
        const rows = acronym.map((entry) => `
          <div class="acronym-row">
            <span class="acronym-letter">${esc(entry.letter)}</span>
            <span class="acronym-def">${esc(entry.definition)}</span>
          </div>
        `).join('')
        return `<div class="acronym-block">${rows}</div>`
      }
      return `<p>${esc(p)}</p>`
    })
    .join('')
}
