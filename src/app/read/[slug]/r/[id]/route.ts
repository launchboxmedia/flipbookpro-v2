import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { renderResourceMarkdown, stripLeadingTitle } from '@/lib/resources'
import { cookieNameForSlug, verifyAccessToken } from '@/lib/readAccess'
import type { AccessType, BookResource } from '@/types/database'

// Public, print-ready HTML for one resource attached to a published book.
// Same pattern as /api/books/[id]/export-pdf — return a self-contained HTML
// document with print CSS + an auto-fired window.print().
//
// Access rules mirror the /read/[slug] page:
//   - free  → anyone with the slug
//   - email → soft gate; readers can hit the URL directly with the resource
//             id. Email gating only protects the flipbook itself, not these
//             downloads. The resource id is unguessable per the underlying
//             uuid.
//   - paid  → requires the signed access cookie set by /api/read/grant.

const TYPE_LABEL: Record<BookResource['resource_type'], string> = {
  'checklist':  'Checklist',
  'template':   'Template',
  'script':     'Script',
  'matrix':     'Matrix',
  'workflow':   'Workflow',
  'swipe-file': 'Swipe File',
}

interface PublishedRow {
  book_id: string
  access_type: AccessType | null
  gate_type: 'none' | 'email' | 'payment' | null
  is_active: boolean
}

export async function GET(_req: NextRequest, { params }: { params: { slug: string; id: string } }) {
  const supabase = await createClient()

  const { data: pub } = await supabase
    .from('published_books')
    .select('book_id, access_type, gate_type, is_active')
    .eq('slug', params.slug)
    .eq('is_active', true)
    .single<PublishedRow>()

  if (!pub) return new NextResponse('Not found', { status: 404 })

  const { data: resource } = await supabase
    .from('book_resources')
    .select('id, book_id, chapter_index, resource_name, resource_type, content, created_at, updated_at')
    .eq('id', params.id)
    .eq('book_id', pub.book_id)
    .single<BookResource>()

  if (!resource) return new NextResponse('Not found', { status: 404 })

  // Paid books — require the signed access cookie keyed to this slug.
  const accessType: AccessType = pub.access_type
    ?? (pub.gate_type === 'none' ? 'free' :
        pub.gate_type === 'payment' ? 'paid' : 'email')
  if (accessType === 'paid') {
    const jar = await cookies()
    const token = jar.get(cookieNameForSlug(params.slug))?.value
    if (!verifyAccessToken(token, params.slug)) {
      return NextResponse.redirect(new URL(`/read/${params.slug}`, _req.url))
    }
  }

  // Strip the resource's own `# Title` line — the printable page already
  // frames it with the type-badge + .title heading above.
  const body = renderResourceMarkdown(stripLeadingTitle(resource.content))
  const title = esc(resource.resource_name)
  const typeLabel = esc(TYPE_LABEL[resource.resource_type] ?? resource.resource_type)

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Source+Serif+4:wght@400;600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
<style>
:root { --accent: #C9A84C; }
*, *::before, *::after { box-sizing: border-box; }
@page { size: A4; margin: 2.2cm 2.4cm; }
body {
  font-family: 'Source Serif 4', Georgia, serif;
  color: #1A1A1A;
  line-height: 1.65;
  font-size: 11.5pt;
  margin: 0;
  padding: 4rem 3rem;
  background: #FAF7F2;
}
.page {
  max-width: 720px;
  margin: 0 auto;
  background: white;
  border: 1px solid #EDE6D8;
  border-radius: 4px;
  padding: 3rem 3rem 2.5rem;
}
.type-badge {
  display: inline-block;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 0.65rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--accent);
  margin-bottom: 0.5rem;
}
.title {
  font-family: 'Playfair Display', Georgia, serif;
  font-size: 1.8rem;
  line-height: 1.2;
  color: #1A1A1A;
  margin: 0 0 1.2rem;
}
.rule {
  width: 2.5rem;
  height: 2px;
  background: var(--accent);
  margin-bottom: 1.6rem;
}
h1, h2, h3 { font-family: 'Playfair Display', Georgia, serif; color: #1A1A1A; }
h1 { font-size: 1.45rem; margin: 0 0 0.5rem; }
h2 { font-size: 1.18rem; margin: 1.35rem 0 0.45rem; }
h3 { font-size: 1.02rem; margin: 1.05rem 0 0.3rem; }
p  { margin: 0 0 0.85rem; }
ul, ol { margin: 0 0 1rem 1.2rem; padding: 0; }
li { margin: 0.3rem 0; }
.resource-list { list-style: none; padding-left: 0; }
.resource-checkitem { display: flex; align-items: flex-start; gap: 0.55rem; margin: 0.32rem 0; }
.resource-checkbox { display: inline-block; width: 0.85rem; height: 0.85rem; border: 1.5px solid #1A1A1A; border-radius: 2px; margin-top: 0.28rem; flex-shrink: 0; }
.resource-checkbox.checked { background: var(--accent); border-color: var(--accent); }
.resource-fill { display: inline-block; min-width: 8rem; border-bottom: 1px solid var(--accent); }
.resource-table { width: 100%; border-collapse: collapse; margin: 0.7rem 0 1.2rem; font-size: 10.5pt; }
.resource-table th, .resource-table td { border: 1px solid #EDE6D8; padding: 0.45rem 0.55rem; text-align: left; }
.resource-table th { background: rgba(201,168,76,0.12); color: #1A1A1A; font-weight: 600; }
strong { font-weight: 600; color: #1A1A1A; }
em { font-style: italic; }
hr { border: 0; border-top: 1px solid #EDE6D8; margin: 1.2rem 0; }
.print-banner {
  position: fixed;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  background: #1A1A1A;
  color: #F5F0E8;
  border: 1px solid #2A3448;
  padding: 10px 14px;
  border-radius: 8px;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.35);
}
.print-banner button {
  background: #C9A84C;
  color: #111;
  border: 0;
  padding: 6px 10px;
  border-radius: 4px;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
.print-banner-close {
  background: transparent !important;
  color: rgba(245,240,232,0.5) !important;
  font-size: 18px !important;
  padding: 0 4px !important;
  line-height: 1;
}
@media print {
  body { background: white; padding: 0; }
  .page { border: 0; padding: 0; }
  .print-banner { display: none !important; }
  *, *::before, *::after { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
</style>
</head>
<body>
<div class="print-banner" id="printBanner">
  <span><strong>Save as PDF:</strong> use the print dialog and choose "Save as PDF".</span>
  <button onclick="window.print()">Print</button>
  <button class="print-banner-close" onclick="document.getElementById('printBanner').remove()" aria-label="Dismiss">&times;</button>
</div>
<div class="page">
  <div class="type-badge">${typeLabel}</div>
  <h1 class="title">${title}</h1>
  <div class="rule"></div>
  ${body}
</div>
<script>
window.addEventListener('load', function () {
  setTimeout(function () { window.print() }, 500)
})
</script>
</body>
</html>`

  return new NextResponse(html, {
    headers: {
      'Content-Type':  'text/html; charset=utf-8',
      'Cache-Control': 'private, max-age=60',
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
