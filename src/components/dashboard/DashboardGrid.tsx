import Link from 'next/link'
import { BookOpen, ExternalLink } from 'lucide-react'
import { CopyLinkButton } from './CopyLinkButton'

type BookRow = {
  id: string
  title: string
  status: string
  updated_at: string
  cover_image_url: string | null
}

interface RecentLead {
  email: string
  name: string | null
  created_at: string
  book_title: string
}

interface Props {
  books: BookRow[]
  chapterStats: Record<string, { total: number; approved: number }>
  publishedByBook: Record<string, { is_active: boolean; slug: string }>
  leadsByBook: Record<string, number>
  recentLeads: RecentLead[]
}

// Landing-page base URL. NEXT_PUBLIC_APP_URL is the canonical origin used by
// PublishPanel + the publish API; falling back to a relative URL keeps the
// link working in any environment (dev, preview, prod) without baking a
// production hostname into the component.
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
function landingUrl(slug: string): string {
  return `${APP_URL}/go/${slug}`
}
// Pretty display of the same URL — strip protocol so the dashboard reads
// like "host/go/slug" instead of leading with "https://".
function landingDisplay(slug: string): string {
  return landingUrl(slug).replace(/^https?:\/\//, '')
}

// Categorize each book into a single bucket. Order matters because a book can
// satisfy more than one condition (e.g., a published book is also "ready" by
// virtue of having all chapters approved). Published wins, then ready, then
// in-progress, then anything else falls through to in-progress as a default.
function bucketFor(
  book: BookRow,
  stats: { total: number; approved: number } | undefined,
  pub: { is_active: boolean; slug: string } | undefined,
): 'published' | 'ready' | 'in-progress' | 'idle' {
  if (pub?.is_active) return 'published'
  const allApproved = !!stats && stats.total > 0 && stats.approved === stats.total
  if (allApproved || book.status === 'ready' || book.status === 'shelf-ready') return 'ready'
  if (stats && stats.total > 0) return 'in-progress'
  return 'idle'
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  const diff = Date.now() - then
  if (diff < 60_000) return 'just now'
  const m = Math.floor(diff / 60_000)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d} day${d === 1 ? '' : 's'} ago`
  const w = Math.floor(d / 7)
  if (w < 5) return `${w} week${w === 1 ? '' : 's'} ago`
  const mo = Math.floor(d / 30)
  if (mo < 12) return `${mo} month${mo === 1 ? '' : 's'} ago`
  const y = Math.floor(d / 365)
  return `${y} year${y === 1 ? '' : 's'} ago`
}

function CoverThumb({ url, title }: { url: string | null; title: string }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={`${title} cover`} className="w-10 h-14 rounded object-cover shrink-0" />
  }
  return (
    <div className="w-10 h-14 rounded bg-ink-3 flex items-center justify-center text-gold shrink-0" aria-hidden="true">
      <BookOpen className="w-4 h-4" />
    </div>
  )
}

interface RowProps {
  index: number
  children: React.ReactNode
  className?: string
}

function Card({ index, children, className }: RowProps) {
  return (
    <div
      style={{ ['--card-index' as string]: index } as React.CSSProperties}
      className={`dash-card flex items-center gap-4 bg-ink-2 rounded-xl p-5 border border-ink-4 transition-colors duration-220 mb-3 ${className ?? ''}`}
    >
      {children}
    </div>
  )
}

export function DashboardGrid({
  books,
  chapterStats,
  publishedByBook,
  leadsByBook,
  recentLeads,
}: Props) {
  const ready: BookRow[] = []
  const published: BookRow[] = []
  const inProgress: BookRow[] = []
  for (const b of books) {
    const bucket = bucketFor(b, chapterStats[b.id], publishedByBook[b.id])
    if (bucket === 'published') published.push(b)
    else if (bucket === 'ready') ready.push(b)
    else inProgress.push(b)
  }

  let cardIndex = 0

  return (
    <div className="space-y-10">
      {ready.length > 0 && (
        <section>
          <p className="text-gold text-xs font-inter uppercase tracking-widest mb-4">Ready to Publish</p>
          {ready.map((b) => {
            const stats = chapterStats[b.id]
            const i = cardIndex++
            return (
              <Card
                key={b.id}
                index={i}
                className="border-l-2 border-l-gold hover:border-gold/30"
              >
                <CoverThumb url={b.cover_image_url} title={b.title} />
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-semibold text-base truncate">{b.title}</h3>
                  <p className="text-white/40 text-sm">
                    {stats ? `${stats.total} chapter${stats.total === 1 ? '' : 's'} · All approved` : 'Ready'}
                  </p>
                </div>
                <Link
                  href={`/book/${b.id}/coauthor`}
                  className="bg-gold text-ink-1 text-sm font-semibold font-inter px-4 py-2 rounded-lg whitespace-nowrap hover:bg-gold-soft transition-colors duration-220"
                >
                  Publish Now →
                </Link>
              </Card>
            )
          })}
        </section>
      )}

      {published.length > 0 && (
        <section>
          <p className="text-white/40 text-xs font-inter uppercase tracking-widest mb-4">Published</p>
          {published.map((b) => {
            const pub = publishedByBook[b.id]!
            const leads = leadsByBook[b.id] ?? 0
            const i = cardIndex++
            return (
              <Card key={b.id} index={i} className="hover:border-ink-3">
                <CoverThumb url={b.cover_image_url} title={b.title} />
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-semibold text-base truncate">{b.title}</h3>
                  {leads > 0 ? (
                    <p className="text-gold text-sm">{leads} reader{leads === 1 ? '' : 's'}</p>
                  ) : (
                    <>
                      <p className="text-white/30 text-sm">No readers yet</p>
                      <p className="text-white/30 text-xs">Share your link to get your first reader</p>
                    </>
                  )}
                  <p className="text-white/20 text-xs truncate">{landingDisplay(pub.slug)}</p>
                </div>
                <div className="flex gap-2 shrink-0 items-center">
                  <CopyLinkButton url={landingUrl(pub.slug)} prominent={leads === 0} />
                  <a
                    href={landingUrl(pub.slug)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Open published book"
                    className="p-2 text-white/40 hover:text-white transition-colors duration-220"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </Card>
            )
          })}
        </section>
      )}

      {inProgress.length > 0 && (
        <section>
          <p className="text-white/40 text-xs font-inter uppercase tracking-widest mb-4">In Progress</p>
          {inProgress.map((b) => {
            const stats = chapterStats[b.id]
            const i = cardIndex++
            return (
              <Card key={b.id} index={i} className="hover:border-ink-3">
                <CoverThumb url={b.cover_image_url} title={b.title} />
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-semibold text-base truncate">{b.title}</h3>
                  <p className="text-white/40 text-sm">
                    {stats
                      ? `${stats.approved}/${stats.total} chapter${stats.total === 1 ? '' : 's'} approved`
                      : 'Just getting started'}
                  </p>
                </div>
                <Link
                  href={`/book/${b.id}/coauthor`}
                  className="bg-ink-3 text-white text-sm font-inter font-semibold px-4 py-2 rounded-lg hover:bg-ink-4 transition-colors duration-220 whitespace-nowrap"
                >
                  Continue →
                </Link>
              </Card>
            )
          })}
        </section>
      )}

      {recentLeads.length > 0 && (
        <section>
          <p className="text-white/40 text-xs font-inter uppercase tracking-widest mb-4">Recent Readers</p>
          <div className="bg-ink-2 rounded-xl border border-ink-4">
            {recentLeads.map((lead, i) => {
              const initial = (lead.email[0] ?? '?').toUpperCase()
              return (
                <div
                  key={`${lead.email}-${lead.created_at}-${i}`}
                  className="flex items-center gap-3 px-5 py-4 border-b border-ink-3 last:border-0"
                >
                  <div
                    className="w-8 h-8 rounded-full bg-teal-800 flex items-center justify-center text-white text-xs font-semibold shrink-0"
                    aria-hidden="true"
                  >
                    {initial}
                  </div>
                  <p className="text-white text-sm flex-1 truncate">{lead.email}</p>
                  <p className="text-white/40 text-xs max-w-[200px] truncate hidden sm:block">{lead.book_title}</p>
                  <p className="text-white/30 text-xs whitespace-nowrap">{timeAgo(lead.created_at)}</p>
                </div>
              )
            })}
          </div>
          <div className="mt-3 text-right">
            <Link href="/settings/leads" className="text-gold text-xs font-inter hover:text-gold-soft transition-colors duration-220">
              View all leads →
            </Link>
          </div>
        </section>
      )}
    </div>
  )
}
