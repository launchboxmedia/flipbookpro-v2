import type { Metadata } from 'next'
import { Playfair_Display, Source_Serif_4, Inter } from 'next/font/google'
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

export const metadata: Metadata = {
  title: 'FlipBookPro — AI-Powered Flipbook Creator',
  description: 'Create stunning AI-illustrated flipbooks in minutes.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${playfair.variable} ${sourceSerif.variable} ${inter.variable}`}>
      <body className="font-inter antialiased bg-canvas text-cream">
        {children}
      </body>
    </html>
  )
}
