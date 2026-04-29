import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { paginateText } from '@/lib/paginateText'

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

  const { data: pages } = await supabase
    .from('book_pages')
    .select('*')
    .eq('book_id', params.bookId)
    .order('chapter_index', { ascending: true })

  const chapters = (pages ?? []).filter((p) => p.chapter_index >= 0)
  const backMatter = (pages ?? []).filter((p) => p.chapter_index < 0 && p.content)

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
  const chaptersHtml = chapters.map((ch, i) => {
    const chunks = paginateText(ch.content ?? '')
    return chunks.map((chunk, k) => {
      const isFirst = k === 0
      const header = isFirst
        ? `<div class="chapter-header">
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
          ${header}
          ${image}
          <div class="chapter-body">${paragraphs(chunk)}</div>
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

<section class="cover">
  <h1 class="cover-title">${esc(book.title)}</h1>
  ${book.subtitle ? `<p class="cover-subtitle">${esc(book.subtitle)}</p>` : ''}
  ${book.author_name ? `<div class="cover-divider"></div><p class="cover-author">${esc(book.author_name)}</p>` : ''}
</section>

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
    .map((p) => `<p>${esc(p)}</p>`)
    .join('')
}
