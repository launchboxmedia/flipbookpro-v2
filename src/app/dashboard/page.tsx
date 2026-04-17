import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { logout } from '@/app/login/actions'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-canvas text-cream">
      <header className="border-b border-[#333] px-6 py-4 flex items-center justify-between">
        <h1 className="font-playfair text-2xl text-cream">FlipBookPro</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm font-inter text-muted-foreground">{user.email}</span>
          <form action={logout}>
            <button
              type="submit"
              className="text-sm font-inter text-cream/60 hover:text-cream transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <main className="px-6 py-12 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h2 className="font-playfair text-3xl text-cream">Your Books</h2>
          <button className="px-4 py-2 bg-accent hover:bg-accent/90 text-cream font-inter text-sm font-medium rounded-md transition-colors">
            + New Book
          </button>
        </div>

        <div className="text-center py-24 text-muted-foreground font-source-serif">
          <p className="text-lg">No books yet.</p>
          <p className="text-sm mt-2">Click <span className="text-gold">New Book</span> to get started.</p>
        </div>
      </main>
    </div>
  )
}
