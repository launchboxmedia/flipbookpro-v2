import Link from 'next/link'
import { logout } from '@/app/login/actions'
import { CreditCard, Palette } from 'lucide-react'

export function TopNav({ email }: { email: string }) {
  return (
    <header className="border-b border-[#333] bg-[#1A1A1A] px-6 py-3 flex items-center justify-between sticky top-0 z-40">
      <Link href="/dashboard" className="font-playfair text-xl text-cream hover:text-cream/80 transition-colors">
        FlipBookPro
      </Link>
      <div className="flex items-center gap-1">
        <Link
          href="/settings/brand"
          className="flex items-center gap-1.5 text-xs font-inter text-muted-foreground hover:text-cream transition-colors px-3 py-1.5 rounded-md hover:bg-[#2A2A2A]"
        >
          <Palette className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Brand</span>
        </Link>
        <Link
          href="/settings/billing"
          className="flex items-center gap-1.5 text-xs font-inter text-muted-foreground hover:text-cream transition-colors px-3 py-1.5 rounded-md hover:bg-[#2A2A2A]"
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Billing</span>
        </Link>
        <span className="text-xs font-inter text-muted-foreground hidden sm:block px-2">{email}</span>
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
