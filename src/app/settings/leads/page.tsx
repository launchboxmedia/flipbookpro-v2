import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Download, Mail } from 'lucide-react'

export const metadata = { title: 'Leads — FlipBookPro' }

export default async function LeadsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch leads for all of this user's published books
  const { data: leads } = await supabase
    .from('leads')
    .select(`
      id,
      email,
      name,
      source,
      created_at,
      published_books!inner (
        title,
        user_id
      )
    `)
    .eq('published_books.user_id', user.id)
    .order('created_at', { ascending: false })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (leads ?? []).map((lead: any) => ({
    id: lead.id,
    email: lead.email,
    name: lead.name,
    book_title: lead.published_books?.title ?? 'Unknown',
    source: lead.source,
    created_at: lead.created_at,
  }))

  const totalLeads = rows.length

  // Serialize for client-side CSV export
  const csvData = JSON.stringify(rows.map(r => ({
    email: r.email,
    name: r.name ?? '',
    book: r.book_title,
    source: r.source,
    date: new Date(r.created_at).toLocaleDateString(),
  })))

  return (
    <div className="px-8 py-10 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="font-playfair text-3xl text-ink-1">Leads</h2>
          <p className="text-ink-1/60 text-sm font-source-serif mt-1">
            {totalLeads} lead{totalLeads !== 1 ? 's' : ''} collected
          </p>
        </div>
        {totalLeads > 0 && (
          <button
            id="export-csv-btn"
            className="flex items-center gap-2 px-4 py-2 bg-gold hover:bg-gold/90 text-ink-1 text-sm font-inter font-medium rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        )}
      </div>

      {/* Stats card */}
      {totalLeads > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white border border-cream-3 rounded-xl px-5 py-4">
            <p className="text-xs font-inter font-medium text-ink-1/60 uppercase tracking-wider mb-1">Total Leads</p>
            <p className="text-2xl font-playfair text-ink-1">{totalLeads}</p>
          </div>
          <div className="bg-white border border-cream-3 rounded-xl px-5 py-4">
            <p className="text-xs font-inter font-medium text-ink-1/60 uppercase tracking-wider mb-1">Unique Emails</p>
            <p className="text-2xl font-playfair text-ink-1">
              {new Set(rows.map(r => r.email)).size}
            </p>
          </div>
          <div className="bg-white border border-cream-3 rounded-xl px-5 py-4">
            <p className="text-xs font-inter font-medium text-ink-1/60 uppercase tracking-wider mb-1">Books with Leads</p>
            <p className="text-2xl font-playfair text-ink-1">
              {new Set(rows.map(r => r.book_title)).size}
            </p>
          </div>
        </div>
      )}

      {/* Table or empty state */}
      {totalLeads === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <Mail className="w-12 h-12 text-[#333] mb-4" />
          <h3 className="font-playfair text-xl text-ink-1/60 mb-2">No leads yet</h3>
          <p className="text-ink-1/60 text-sm font-source-serif mb-6 max-w-sm">
            Publish a book with an email gate to start collecting leads from your readers.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-cream-3 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-cream-3">
                <th className="text-left px-5 py-3 text-xs font-inter font-medium text-ink-1/60 uppercase tracking-wider">Email</th>
                <th className="text-left px-5 py-3 text-xs font-inter font-medium text-ink-1/60 uppercase tracking-wider">Name</th>
                <th className="text-left px-5 py-3 text-xs font-inter font-medium text-ink-1/60 uppercase tracking-wider">Book</th>
                <th className="text-left px-5 py-3 text-xs font-inter font-medium text-ink-1/60 uppercase tracking-wider">Source</th>
                <th className="text-left px-5 py-3 text-xs font-inter font-medium text-ink-1/60 uppercase tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((lead, i) => (
                <tr key={lead.id} className={`border-b border-cream-3 ${i === rows.length - 1 ? 'border-b-0' : ''}`}>
                  <td className="px-5 py-3 text-sm font-inter text-ink-1">{lead.email}</td>
                  <td className="px-5 py-3 text-sm font-inter text-ink-1/70">{lead.name ?? '—'}</td>
                  <td className="px-5 py-3 text-sm font-inter text-accent truncate max-w-[200px]">{lead.book_title}</td>
                  <td className="px-5 py-3">
                    <span className="inline-block text-xs font-inter font-medium px-2 py-0.5 rounded-full bg-cream-3 text-ink-1/60 capitalize">
                      {lead.source}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs font-inter text-ink-1/60">
                    {new Date(lead.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Client-side CSV export script */}
      {totalLeads > 0 && (
        <script
          dangerouslySetInnerHTML={{
            __html: `
              document.getElementById('export-csv-btn')?.addEventListener('click', function() {
                var rows = ${csvData};
                if (!rows.length) return;
                var headers = ['email','name','book','source','date'];
                var csv = [headers.join(',')];
                rows.forEach(function(r) {
                  csv.push(headers.map(function(h) {
                    var val = (r[h] || '').toString().replace(/"/g, '""');
                    return '"' + val + '"';
                  }).join(','));
                });
                var blob = new Blob([csv.join('\\n')], { type: 'text/csv' });
                var url = URL.createObjectURL(blob);
                var a = document.createElement('a');
                a.href = url;
                a.download = 'leads-' + new Date().toISOString().slice(0,10) + '.csv';
                a.click();
                URL.revokeObjectURL(url);
              });
            `,
          }}
        />
      )}
    </div>
  )
}
