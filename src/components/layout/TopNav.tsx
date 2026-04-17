import Link from 'next/link'
import { logout } from '@/app/login/actions'
import { Settings } from 'lucide-react'

export function TopNav({ email }: { email: string }) {
  return (
    <header className="border-b border-[#333] bg-[#1A1A1A] px-6 py-3 flex items-center justify-between sticky top-0 z-40">
      <Link href="/dashboard" className="font-playfair text-xl text-cream hover:text-cream/80 transition-colors">
        FlipBookPro
      </Link>
      <div className="flex items-center gap-4">
        <Link href="/settings" className="text-muted-foreground hover:text-cream transition-colors">
          <Settings className="w-4 h-4" />
        </Link>
        <span className="text-xs font-inter text-muted-foreground hidden sm:block">{email}</span>
        <form action={logout}>
          <button
            type="submit"
            className="text-xs font-inter text-muted-foreground hover:text-cream transition-colors px-3 py-1.5 rounded-md hover:bg-[#2A2A2A]"
          >
            Sign out
          </button>
        </form>
      </div>
    </header>
  )
}
