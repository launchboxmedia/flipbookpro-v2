'use client'

import { Toaster } from 'sonner'
import { TooltipProvider } from '@radix-ui/react-tooltip'

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider delayDuration={250}>
      {children}
      <Toaster
        position="bottom-right"
        theme="dark"
        toastOptions={{
          // Keep toasts on-brand: ink panel, cream text, gold for success.
          style: {
            background: '#151C28',
            border: '1px solid #2A3448',
            color: '#F5F0E8',
            fontFamily: 'var(--font-inter), Inter, sans-serif',
          },
        }}
      />
    </TooltipProvider>
  )
}
