import type { Metadata } from 'next'
import { Playfair_Display, Source_Serif_4, Inter, JetBrains_Mono } from 'next/font/google'
import { AppProviders } from '@/components/providers/AppProviders'
import { AppBootWrapper } from '@/components/ui/AppBootWrapper'
import './globals.css'

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
})

const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  variable: '--font-source-serif',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'FlipBookPro — AI-Powered Flipbook Creator',
  description: 'Create stunning AI-illustrated flipbooks in minutes.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${playfair.variable} ${sourceSerif.variable} ${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="font-inter antialiased bg-canvas text-cream">
        <AppProviders>
          <AppBootWrapper>{children}</AppBootWrapper>
        </AppProviders>
      </body>
    </html>
  )
}
