import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEffectivePlan, planAtLeast } from '@/lib/auth'
import { paginateText } from '@/lib/paginateText'

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

  const accent = profile?.brand_color ?? '#C9A84C'
  const chapters = (pages ?? []).filter((p) => p.chapter_index >= 0)
  const backMatter = (pages ?? []).filter((p) => p.chapter_index < 0 && p.content)

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

  // Sentence-aware pagination — same chunks as the flipbook viewer and HTML
  // export. Each chunk becomes its own printed page; first chunk gets the
  // full chapter header + image, continuation chunks get a compact header.
  const chaptersHtml = chapters.map((ch, i) => {
    const chunks = paginateText(ch.content ?? '')
    return chunks.map((chunk, k) => {
      if (k === 0) {
        return `
          <section class="page chapter">
            <span class="chapter-label">Chapter ${i + 1}</span>
            <h2 class="chapter-title">${esc(ch.chapter_title)}</h2>
            <div class="rule"></div>
            ${ch.image_url ? `<img src="${esc(ch.image_url)}" class="chapter-img" alt="" />` : ''}
            <div class="body">${paragraphs(chunk)}</div>
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

${tocHtml}
${chaptersHtml}
${backMatterHtml}
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
      'Content-Type': 'text/html; charset=utf-8',
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
    .map((p) => `<p>${esc(p)}</p>`)
    .join('')
}
