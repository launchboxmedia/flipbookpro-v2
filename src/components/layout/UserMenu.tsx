'use client'

import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import Link from 'next/link'
import { User, CreditCard, Building2, LogOut, Crown, ChevronUp } from 'lucide-react'
import { logout } from '@/app/login/actions'

interface Props {
  userEmail: string
  isPremium?: boolean
  isAdmin?: boolean
  collapsed?: boolean
}

function initials(email: string) {
  const parts = email.split('@')[0].replace(/[^a-zA-Z]/g, ' ').trim().split(/\s+/)
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || 'U'
}

export function UserMenu({ userEmail, isPremium = false, isAdmin = false, collapsed = false }: Props) {
  const userInitials = initials(userEmail)
  const local = userEmail.split('@')[0]

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          aria-label="User menu"
          className={`group w-full flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-ink-2 transition-colors ${collapsed ? 'justify-center' : ''}`}
        >
          <div className="relative w-8 h-8 rounded-full bg-ink-3 border border-ink-4 flex items-center justify-center shrink-0">
            <span className="text-xs font-inter font-semibold text-cream">{userInitials}</span>
            {isPremium && (
              <span
                aria-label="Premium"
                className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-gold flex items-center justify-center ring-2 ring-ink-1"
              >
                <Crown className="w-2 h-2 text-ink-1" />
              </span>
            )}
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-xs font-inter text-cream truncate">{local}</p>
                <p className="text-[10px] font-inter text-ink-subtle truncate">
                  {isAdmin ? 'Admin' : isPremium ? 'Premium' : 'Free'}
                </p>
              </div>
              <ChevronUp className="w-3.5 h-3.5 text-ink-subtle shrink-0 group-data-[state=open]:rotate-180 transition-transform" />
            </>
          )}
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          side="top"
          sideOffset={8}
          className="z-50 min-w-[220px] bg-ink-2 border border-ink-3 rounded-lg p-1.5 shadow-2xl animate-slide-up"
        >
          <div className="px-2.5 py-2 border-b border-ink-3 mb-1">
            <p className="text-xs font-inter text-cream truncate">{userEmail}</p>
            <p className="text-[10px] font-inter text-ink-subtle mt-0.5">
              {isAdmin ? 'Admin · Unlimited' : isPremium ? 'Premium plan' : 'Free plan'}
            </p>
          </div>

          <DropdownMenu.Item asChild>
            <Link
              href="/settings/profile"
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm font-inter text-cream/80 hover:bg-ink-3 hover:text-cream cursor-pointer outline-none"
            >
              <User className="w-3.5 h-3.5 text-ink-subtle" /> Profile
            </Link>
          </DropdownMenu.Item>

          <DropdownMenu.Item asChild>
            <Link
              href="/settings/brand"
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm font-inter text-cream/80 hover:bg-ink-3 hover:text-cream cursor-pointer outline-none"
            >
              <Building2 className="w-3.5 h-3.5 text-ink-subtle" /> Brand
            </Link>
          </DropdownMenu.Item>

          <DropdownMenu.Item asChild>
            <Link
              href="/settings/billing"
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm font-inter text-cream/80 hover:bg-ink-3 hover:text-cream cursor-pointer outline-none"
            >
              <CreditCard className="w-3.5 h-3.5 text-ink-subtle" /> Billing
            </Link>
          </DropdownMenu.Item>

          {!isPremium && (
            <DropdownMenu.Item asChild>
              <Link
                href="/settings/billing"
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm font-inter text-gold/90 hover:bg-gold/10 hover:text-gold cursor-pointer outline-none"
              >
                <Crown className="w-3.5 h-3.5" /> Upgrade plan
              </Link>
            </DropdownMenu.Item>
          )}

          <DropdownMenu.Separator className="h-px bg-ink-3 my-1" />

          <form action={logout}>
            <DropdownMenu.Item asChild>
              <button
                type="submit"
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm font-inter text-cream/70 hover:bg-ink-3 hover:text-cream text-left cursor-pointer outline-none"
              >
                <LogOut className="w-3.5 h-3.5 text-ink-subtle" /> Sign out
              </button>
            </DropdownMenu.Item>
          </form>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
