import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEffectivePlan, planAtLeast } from '@/lib/auth'
import { paginateText } from '@/lib/paginateText'
import { detectAcronymBlock } from '@/lib/acronymBlock'
import { renderResourceMarkdown, stripLeadingTitle } from '@/lib/resources'
import type { BookResource, FrameworkData } from '@/types/database'

const RESOURCE_TYPE_LABEL: Record<BookResource['resource_type'], string> = {
  'checklist':  'Checklist',
  'template':   'Template',
  'script':     'Script',
  'matrix':     'Matrix',
  'workflow':   'Workflow',
  'swipe-file': 'Swipe File',
}

export async function GET(_req: NextRequest, { params }: { params: { bookId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // PDF export is Standard, Pro, or Admin only.
  const { plan } = await getEffectivePlan(supabase, user.id)
  if (!planAtLeast(plan, 'standard')) {
    return NextResponse.json(
      { error: 'PDF export requires a Standard or Pro plan. Upgrade at /pricing.' },
      { status: 403 }
    )
  }

  const { data: book } = await supabase
    .from('books')
    .select('*')
    .eq('id', params.bookId)
    .eq('user_id', user.id)
    .single()

  if (!book) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: pages } = await supabase
    .from('book_pages')
    .select('*')
    .eq('book_id', params.bookId)
    .order('chapter_index', { ascending: true })

  const { data: profile } = await supabase
    .from('profiles')
    .select('logo_url, brand_color, full_name, author_bio, social_links')
    .eq('id', user.id)
    .single()

  const { data: resources } = await supabase
    .from('book_resources')
    .select('*')
    .eq('book_id', params.bookId)
    .order('chapter_index', { ascending: true })
    .order('resource_name', { ascending: true })

  const accent = profile?.brand_color ?? '#C9A84C'
  const allChapters = (pages ?? []).filter((p) => p.chapter_index >= 0)
  const backMatter = (pages ?? []).filter((p) => p.chapter_index < 0 && p.content)

  // Pull a front-matter "Introduction"/"Preface"/"Foreword" chapter out of
  // the regular sequence (mirrors FlipbookViewer + HTML export behavior).
  const isIntroChapter = (ch: typeof allChapters[number]) =>
    /^(introduction|preface|foreword)\b/i.test((ch.chapter_title ?? '').trim())
  const introChapter = allChapters[0] && isIntroChapter(allChapters[0]) ? allChapters[0] : null
  const chapters = introChapter ? allChapters.slice(1) : allChapters

  // Introduction is rendered ONLY when the book has an explicit intro
  // chapter. Never auto-promote chapter 1 as a teaser — that would surface
  // chapter content before the TOC.
  const introContent = introChapter ? (introChapter.content ?? '') : ''
  const introTitle = introChapter?.chapter_title ?? null

  const imprint  = profile?.full_name?.trim() || 'LaunchBox.Media'
  const author   = book.author_name || profile?.full_name || 'Author'
  const bookYear = (() => {
    const created = book.created_at ? new Date(book.created_at) : null
    if (created && !Number.isNaN(created.getTime())) return created.getFullYear()
    return new Date().getFullYear()
  })()

  const fontSpec = (() => {
    switch (book.typography) {
      case 'executive_serif':
        return { google: 'Source+Serif+4:ital,wght@0,400;0,600;1,400', body: "'Source Serif 4', Georgia, serif" }
      case 'editorial_classic':
      case 'bold_display':
        return { google: 'Playfair+Display:ital,wght@0,400;0,700;1,400', body: "'Playfair Display', Georgia, serif" }
      default:
        return { google: 'Inter:wght@400;500', body: "'Inter', system-ui, sans-serif" }
    }
  })()

  // Front matter — interior title page. Cream surface, all text ink-1,
  // centered. Mirrors the FlipbookViewer's InteriorTitlePage layout.
  const interiorTitleHtml = `
    <section class="page front-title">
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

  // Front matter — copyright page. 10pt Source Serif, centered, em-dash
  // rules between sections.
  const copyrightHtml = `
    <section class="page copyright">
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

  // Front matter — introduction (Introduction/Preface/Foreword chapter or
  // first-chunk teaser). Renders as one section per chunk, each with its
  // own printed page break.
  const introChunks = introContent.trim() ? paginateText(introContent) : []
  const introductionHtml = introChunks.length > 0
    ? introChunks.map((chunk, k) => {
        const header = k === 0
          ? `
            <span class="chapter-label">${esc(introTitle ?? 'Begin')}</span>
            <div class="rule"></div>
          `
          : `
            <div class="cont-header">
              <span class="chapter-label">${esc(introTitle ?? 'Begin')}</span>
              <span class="cont-page">${k + 1} / ${introChunks.length}</span>
            </div>
          `
        return `
          <section class="page chapter introduction${k > 0 ? ' chapter-cont' : ''}">
            ${header}
            <div class="body">${paragraphs(chunk)}</div>
          </section>
        `
      }).join('')
    : ''

  const tocHtml = chapters.length > 0 ? `
    <section class="page toc">
      <h2 class="toc-heading">Contents</h2>
      <div class="rule"></div>
      <ol class="toc-list">
        ${chapters.map((ch, i) => `
          <li>
            <span class="num">${i + 1}</span>
            <span>${esc(ch.chapter_title)}</span>
          </li>
        `).join('')}
      </ol>
    </section>
  ` : ''

  // Map chapter_index → framework letter (matches FlipbookViewer + HTML
  // export behavior). Used to overlay the decorative letter on the chapter
  // opener page.
  const framework = (book.framework_data ?? null) as FrameworkData | null
  const letterByChapterIndex = new Map<number, string>()
  if (framework?.steps) {
    for (const step of framework.steps) {
      if (typeof step.chapter_index === 'number' && step.letter) {
        letterByChapterIndex.set(step.chapter_index, step.letter.toUpperCase())
      }
    }
  }

  // Sentence-aware pagination — same chunks as the flipbook viewer and HTML
  // export. Each chunk becomes its own printed page; first chunk gets the
  // full chapter header + image, continuation chunks get a compact header.
  const chaptersHtml = chapters.map((ch, i) => {
    const chunks = paginateText(ch.content ?? '')
    const frameworkLetter = letterByChapterIndex.get(ch.chapter_index)
    // Pull-quote block — appended inline after the body of the LAST chunk so
    // it sits at the natural end of each chapter in the printed flow. NULL
    // pull_quote means we render nothing (the field hasn't been extracted
    // yet, or extraction failed). The viewer renders the rules even when
    // the quote is null; in print there's no facing-page concern, so we
    // omit the block entirely instead of emitting empty rules.
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
      const isLastChunk = k === chunks.length - 1
      if (k === 0) {
        const overlay = frameworkLetter
          ? `<span class="framework-letter" aria-hidden="true">${esc(frameworkLetter)}</span>`
          : ''
        return `
          <section class="page chapter${frameworkLetter ? ' has-framework-letter' : ''}">
            ${overlay}
            <span class="chapter-label">Chapter ${i + 1}</span>
            <h2 class="chapter-title">${esc(ch.chapter_title)}</h2>
            <div class="rule"></div>
            ${ch.image_url ? `<img src="${esc(ch.image_url)}" class="chapter-img" alt="" />` : ''}
            <div class="body">${paragraphs(chunk)}</div>
            ${isLastChunk ? pullQuoteBlock : ''}
          </section>
        `
      }
      return `
        <section class="page chapter chapter-cont">
          <div class="cont-header">
            <span class="chapter-label">Chapter ${i + 1}</span>
            <span class="cont-title">${esc(ch.chapter_title)}</span>
            <span class="cont-page">${k + 1} / ${chunks.length}</span>
          </div>
          <div class="body">${paragraphs(chunk)}</div>
          ${isLastChunk ? pullQuoteBlock : ''}
        </section>
      `
    }).join('')
  }).join('')

  const backMatterHtml = backMatter.map((bm) => `
    <section class="page chapter">
      <h2 class="chapter-title">${esc(bm.chapter_title)}</h2>
      <div class="rule"></div>
      <div class="body">${paragraphs(bm.content ?? '')}</div>
    </section>
  `).join('')

  // Resources appendix — one printed section per chapter that owns any
  // resources. Each resource gets its own card with a Playfair title +
  // small gold type badge + the rendered markdown body. The leading "#
  // Title" line is stripped from the body to avoid duplicating the title.
  const allResources = (resources ?? []) as BookResource[]
  const resourcesByChapter = new Map<number, BookResource[]>()
  for (const r of allResources) {
    const arr = resourcesByChapter.get(r.chapter_index) ?? []
    arr.push(r)
    resourcesByChapter.set(r.chapter_index, arr)
  }
  const chapterIndexToNumber = new Map<number, number>()
  chapters.forEach((ch, i) => { chapterIndexToNumber.set(ch.chapter_index, i + 1) })

  const appendixHtml = resourcesByChapter.size > 0 ? `
    <section class="page appendix">
      <div class="appendix-title">Resources &amp; Downloads</div>
      ${Array.from(resourcesByChapter.entries())
        .sort(([a], [b]) => a - b)
        .map(([chapterIndex, items]) => {
          const chapterNum = chapterIndexToNumber.get(chapterIndex)
          const label = chapterNum
            ? `Chapter ${chapterNum} Resources`
            : 'Resources'
          return `
            <div class="appendix-chapter">${esc(label)}</div>
            ${items.map((r) => `
              <div class="resource-block">
                <h3 class="resource-title">${esc(r.resource_name)}</h3>
                <div class="resource-type-badge">${esc(RESOURCE_TYPE_LABEL[r.resource_type] ?? r.resource_type)}</div>
                <div class="resource-body">${renderResourceMarkdown(stripLeadingTitle(r.content))}</div>
              </div>
            `).join('')}
          `
        }).join('')}
    </section>
  ` : ''

  const backCoverHtml = (book.back_cover_tagline || book.back_cover_description || book.back_cover_image_url) ? `
    <section class="page back-cover${book.back_cover_image_url ? ' back-cover-with-image' : ''}">
      ${book.back_cover_image_url ? `<img src="${esc(book.back_cover_image_url)}" class="back-cover-img" alt="" />` : ''}
      <div class="back-cover-content">
        ${book.back_cover_tagline ? `<h2 class="back-tagline">${esc(book.back_cover_tagline)}</h2>` : ''}
        ${book.back_cover_description ? `<p class="back-desc">${esc(book.back_cover_description)}</p>` : ''}
        ${book.back_cover_cta_text && book.back_cover_cta_url
          ? `<a href="${esc(book.back_cover_cta_url)}" class="back-cta">${esc(book.back_cover_cta_text)}</a>`
          : ''}
        ${book.author_name ? `<p class="back-author">${esc(book.author_name)}</p>` : ''}
        ${profile?.logo_url ? `<img src="${esc(profile.logo_url)}" class="back-logo" alt="Logo" />` : ''}
      </div>
    </section>
  ` : ''

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${esc(book.title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=${fontSpec.google}&family=Inter:wght@400;500&display=swap" rel="stylesheet" />
<style>
:root { --accent: ${accent}; }
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

@page {
  size: A4;
  margin: 2.2cm 2.5cm;
}

body {
  font-family: ${fontSpec.body};
  color: #1A1A1A;
  line-height: 1.75;
  font-size: 11.5pt;
  background: white;
}

.page { page-break-before: always; }
.page:first-child { page-break-before: avoid; }

/* Cover */
.cover {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  background: #111;
  color: #F5F0E8;
  padding: 4rem 3rem;
  position: relative;
}
.cover::before, .cover::after {
  content: '';
  position: absolute;
  left: 2.5rem; right: 2.5rem;
  height: 1px;
  background: rgba(201,168,76,0.3);
}
.cover::before { top: 2.5rem; }
.cover::after  { bottom: 2.5rem; }
.cover-img {
  width: 100%; max-height: 55vh;
  object-fit: cover;
  position: absolute; inset: 0;
  opacity: 0.35;
}
/* When the uploaded image already contains text, show the artwork at full
   opacity and hide the overlay (the .cover-content div is omitted in HTML). */
.cover-image-only .cover-img {
  max-height: 100vh;
  height: 100%;
  opacity: 1;
}
.cover-content { position: relative; z-index: 1; }
.cover-title {
  font-family: 'Playfair Display', Georgia, serif;
  font-size: 2.6rem;
  line-height: 1.15;
  margin-bottom: 0.75rem;
}
.cover-subtitle { font-size: 1rem; color: var(--accent); font-style: italic; margin-bottom: 1.5rem; }
.cover-divider { width: 2rem; height: 1px; background: rgba(201,168,76,0.5); margin: 0 auto 1.25rem; }
.cover-author { font-family: 'Inter', sans-serif; font-size: 0.65rem; letter-spacing: 0.2em; text-transform: uppercase; color: #888; font-variant: small-caps; }

/* ── Front matter — interior title page ───────────────────────────────── */
.front-title {
  min-height: calc(100vh - 4.4cm); /* @page margins eat 4.4cm vertically */
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding-top: 0;
}
.front-spacer { flex: 1 1 auto; }
.front-title-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.1rem;
  max-width: 28rem;
}
.front-title-heading {
  font-family: 'Playfair Display', Georgia, serif;
  font-size: 2.4rem;
  font-weight: 700;
  line-height: 1.15;
  margin: 0;
  letter-spacing: -0.005em;
}
.front-title-subtitle {
  font-family: ${fontSpec.body};
  font-size: 1rem;
  font-style: italic;
  color: rgba(26,26,26,0.7);
  margin: 0;
}
.front-title-rule {
  width: 2.5rem;
  height: 1px;
  background: var(--accent);
  margin: 0.5rem 0;
}
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
  min-height: calc(100vh - 4.4cm);
  display: flex;
  align-items: center;
  justify-content: center;
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
  font-size: 10pt;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  margin: 0;
  opacity: 0.95;
}
.copyright-line {
  font-family: 'Source Serif 4', Georgia, serif;
  font-size: 10pt;
  line-height: 1.55;
  margin: 0;
  opacity: 0.78;
}
.copyright-rule {
  font-family: 'Source Serif 4', Georgia, serif;
  font-size: 10pt;
  margin: 0.7rem 0;
  opacity: 0.35;
  line-height: 1;
}

/* ── Front matter — introduction (uses chapter styles) ────────────────── */
.introduction { padding-top: 3rem; }

/* TOC */
.toc { padding-top: 3rem; }
.toc-heading { font-family: 'Playfair Display', Georgia, serif; font-size: 1.8rem; margin-bottom: 0.75rem; }
.toc-list { list-style: none; margin-top: 1.5rem; }
.toc-list li { display: flex; gap: 0.75rem; padding: 0.4rem 0; border-bottom: 1px solid rgba(0,0,0,0.07); font-size: 0.9rem; }
.num { color: var(--accent); min-width: 1.5rem; font-family: 'Inter', sans-serif; font-size: 0.75rem; padding-top: 0.1em; }

/* Chapter */
.chapter { padding-top: 3rem; }
.chapter-label { display: block; font-family: 'Inter', sans-serif; font-size: 0.65rem; letter-spacing: 0.15em; text-transform: uppercase; color: var(--accent); margin-bottom: 0.4rem; }
.chapter-title { font-family: 'Playfair Display', Georgia, serif; font-size: 1.7rem; line-height: 1.2; margin-bottom: 0.75rem; }
.rule { width: 2rem; height: 2px; background: var(--accent); margin-bottom: 1.75rem; }
.chapter-img { width: 100%; max-height: 200pt; object-fit: cover; border-radius: 3px; margin-bottom: 1.5rem; }
.body p { margin-bottom: 1.1em; }
.body p:last-child { margin-bottom: 0; }

/* Pull quote — appended after each chapter's body when pull_quote exists.
   Two thin gold rules bracketing a centred italic Playfair line. Token
   colour matches the gold accent so it ties to the rest of the typography. */
.pull-quote-block { margin: 2.5rem auto; max-width: 75%; text-align: center; }
.pull-quote-rule { width: 4rem; height: 1px; background-color: var(--accent); margin: 0 auto 1.25rem; }
.pull-quote-block .pull-quote-rule:last-child { margin: 1.25rem auto 0; }
.pull-quote-text { font-family: 'Playfair Display', Georgia, serif; font-style: italic; font-size: 1.2rem; line-height: 1.7; color: #1C2333; margin: 0; padding: 0; }

/* Acronym block — matches the FlipbookViewer layout. */
.acronym-block {
  display: flex;
  flex-direction: column;
  gap: 0.45em;
  margin: 0.4em 0 1.6em;
}
.acronym-row {
  display: flex;
  align-items: baseline;
  gap: 14pt;
}
.acronym-letter {
  font-family: 'Playfair Display', Georgia, serif;
  font-weight: 700;
  font-size: 22pt;
  color: var(--accent);
  line-height: 1;
  width: 1.15em;
  flex-shrink: 0;
  text-align: center;
}
.acronym-def {
  font-family: 'Source Serif 4', Georgia, serif;
  font-size: 11pt;
  line-height: 1.45;
}

/* Framework letter overlay — top right of the chapter opener page,
   80pt gold Playfair, partially overlapping the chapter title. */
.chapter { position: relative; }
.framework-letter {
  position: absolute;
  top: 1.2cm;
  right: 1.2cm;
  font-family: 'Playfair Display', Georgia, serif;
  font-weight: 700;
  font-size: 80pt;
  color: var(--accent);
  opacity: 0.85;
  line-height: 1;
  pointer-events: none;
}
.chapter.has-framework-letter .chapter-title { padding-right: 4rem; }

/* Continuation pages — compact header so the body has the most space. */
.chapter-cont { padding-top: 1.5rem; }
.cont-header {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid rgba(0,0,0,0.08);
  font-size: 0.85rem;
}
.cont-title {
  font-family: 'Playfair Display', Georgia, serif;
  font-style: italic;
  flex: 1;
  color: rgba(26,26,26,0.6);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cont-page {
  font-family: 'Inter', sans-serif;
  font-size: 0.7rem;
  color: rgba(26,26,26,0.5);
  font-variant-numeric: tabular-nums;
}

/* ── Resources appendix ───────────────────────────────────────────────── */
.appendix { padding-top: 3rem; }
.appendix-title {
  font-family: 'Playfair Display', Georgia, serif;
  font-size: 1.5rem;
  color: #C9A84C;
  border-bottom: 2px solid #C9A84C;
  padding-bottom: 8px;
  margin-bottom: 24px;
}
.appendix-chapter {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 0.7rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(26,26,26,0.65);
  margin: 1.4rem 0 0.85rem;
}
.resource-block {
  page-break-inside: avoid;
  margin-bottom: 1.6rem;
  padding-bottom: 1.2rem;
  border-bottom: 1px solid rgba(0,0,0,0.08);
}
.resource-block:last-child { border-bottom: 0; }
.resource-title {
  font-family: 'Playfair Display', Georgia, serif;
  font-size: 1.1rem;
  margin-bottom: 4px;
  color: #1A1A1A;
}
.resource-type-badge {
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #C9A84C;
  margin-bottom: 12px;
}
.resource-body { font-size: 10.5pt; line-height: 1.6; color: #1A1A1A; }
.resource-body h1, .resource-body h2, .resource-body h3 {
  font-family: 'Playfair Display', Georgia, serif;
  color: #1A1A1A;
}
.resource-body h1 { font-size: 1.05rem; margin: 0 0 0.5rem; }
.resource-body h2 { font-size: 0.95rem; margin: 0.9rem 0 0.35rem; }
.resource-body h3 { font-size: 0.88rem; margin: 0.75rem 0 0.3rem; }
.resource-body p  { margin: 0 0 0.6rem; }
.resource-body ul, .resource-body ol { margin: 0 0 0.7rem 1rem; padding: 0; }
.resource-body li { margin: 0.22rem 0; }
.resource-body .resource-list { list-style: none; padding-left: 0; }
.resource-body .resource-checkitem { display: flex; align-items: flex-start; gap: 0.45rem; margin: 0.25rem 0; }
.resource-body .resource-checkbox { display: inline-block; width: 0.75rem; height: 0.75rem; border: 1.5px solid #1A1A1A; border-radius: 2px; margin-top: 0.22rem; flex-shrink: 0; }
.resource-body .resource-checkbox.checked { background: #C9A84C; border-color: #C9A84C; }
.resource-body .resource-fill { display: inline-block; min-width: 7rem; border-bottom: 1px solid #C9A84C; }
.resource-body .resource-table { width: 100%; border-collapse: collapse; margin: 0.6rem 0 0.9rem; font-size: 9.5pt; }
.resource-body .resource-table th, .resource-body .resource-table td { border: 1px solid rgba(0,0,0,0.15); padding: 0.35rem 0.5rem; text-align: left; }
.resource-body .resource-table th { background: rgba(201,168,76,0.1); color: #1A1A1A; font-weight: 600; }
.resource-body strong { font-weight: 600; }
.resource-body em { font-style: italic; }
.resource-body hr { border: 0; border-top: 1px solid rgba(0,0,0,0.15); margin: 0.9rem 0; }

/* Back cover */
.back-cover {
  min-height: 100vh;
  background: #0F0F0F;
  color: #F5F0E8;
  position: relative;
  overflow: hidden;
}
.back-cover-with-image::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.78) 100%);
  z-index: 1;
}
.back-cover-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: 0;
}
.back-cover-content {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 4rem 3rem;
  min-height: 100vh;
}
.back-tagline { font-family: 'Playfair Display', Georgia, serif; font-size: 2rem; margin-bottom: 1.25rem; }
.back-desc { font-family: ${fontSpec.body}; font-size: 0.95rem; color: rgba(245,240,232,0.7); max-width: 36rem; margin: 0 auto 2rem; line-height: 1.7; }
.back-cta {
  display: inline-block;
  padding: 0.6rem 1.75rem;
  background: var(--accent);
  color: #111;
  text-decoration: none;
  font-family: 'Inter', sans-serif;
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  border-radius: 4px;
  margin-bottom: 2rem;
}
.back-author { font-family: 'Inter', sans-serif; font-size: 0.65rem; letter-spacing: 0.2em; text-transform: uppercase; color: #555; font-variant: small-caps; margin-top: auto; }
.back-logo { height: 2rem; width: auto; object-fit: contain; opacity: 0.8; margin-top: 1.5rem; }

@media print {
  .cover, .back-cover { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .print-banner { display: none !important; }
}

.print-banner {
  position: fixed;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  background: #1A1A1A;
  color: #F5F0E8;
  border: 1px solid #2A2A2A;
  border-radius: 8px;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.4);
}
.print-banner-text { line-height: 1.4; }
.print-banner-text strong { color: #C9A84C; font-weight: 600; }
.print-banner button {
  background: #C9A84C;
  color: #111;
  border: 0;
  padding: 6px 12px;
  border-radius: 4px;
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.print-banner button:hover { background: #d4b65a; }
.print-banner-close {
  background: transparent !important;
  color: rgba(245,240,232,0.5) !important;
  font-size: 18px !important;
  padding: 0 4px !important;
  line-height: 1;
}
</style>
</head>
<body>

<div class="print-banner" id="printBanner">
  <span class="print-banner-text">
    <strong>Save as PDF:</strong> use the print dialog and choose "Save as PDF" as the destination.
  </span>
  <button onclick="window.print()">Open print dialog</button>
  <button class="print-banner-close" onclick="document.getElementById('printBanner').remove()" aria-label="Dismiss">&times;</button>
</div>

<section class="cover${book.cover_has_text && book.cover_image_url ? ' cover-image-only' : ''}">
  ${book.cover_image_url ? `<img src="${esc(book.cover_image_url)}" class="cover-img" alt="" />` : ''}
  ${book.cover_has_text && book.cover_image_url ? '' : `
    <div class="cover-content">
      <h1 class="cover-title">${esc(book.title)}</h1>
      ${book.subtitle ? `<p class="cover-subtitle">${esc(book.subtitle)}</p>` : ''}
      ${book.author_name ? `<div class="cover-divider"></div><p class="cover-author">${esc(book.author_name)}</p>` : ''}
    </div>
  `}
</section>

${interiorTitleHtml}
${copyrightHtml}
${introductionHtml}
${tocHtml}
${chaptersHtml}
${backMatterHtml}
${appendixHtml}
${backCoverHtml}

<script>
// Auto-open print dialog on first load. The banner remains visible after the
// user dismisses or completes the dialog so they can re-trigger if needed.
window.addEventListener('load', function () {
  setTimeout(function () { window.print() }, 600)
})
</script>
</body>
</html>`

  return new NextResponse(html, {
    headers: {
      'Content-Type':  'text/html; charset=utf-8',
      // The export reflects whatever lives in book_resources / book_pages
      // at the moment of download. Browsers (and any proxy in between)
      // shouldn't cache the response — otherwise editing a resource then
      // re-exporting would silently serve the prior HTML.
      'Cache-Control': 'no-store, max-age=0',
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
