import Link from 'next/link'
import { Check, ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pricing — FlipBookPro',
  description: 'Simple, transparent pricing. Start free and upgrade when you need more.',
}

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    interval: '',
    annualNote: 'Free forever',
    description: 'Perfect for trying it out.',
    features: [
      '1 book lifetime',
      'Up to 6 chapters',
      'AI co-author',
      'Chapter illustrations',
      'Flipbook preview',
      'HTML export',
      'Publishing with email gate',
    ],
    cta: 'Get started free',
    ctaHref: '/signup',
    highlight: false,
  },
  {
    id: 'standard',
    name: 'Standard',
    price: '$9',
    annualPrice: '$79',
    interval: '/mo',
    annualNote: '$79/yr — save 27%',
    description: 'For prolific creators shipping regularly.',
    features: [
      '3 books per month',
      'Up to 8 chapters',
      'Everything in Free',
      'All export formats (PDF + HTML)',
      'Lead capture & MailerLite sync',
      'Priority support',
    ],
    cta: 'Start Standard',
    ctaHref: '/signup',
    highlight: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$49',
    annualPrice: '$399',
    interval: '/mo',
    annualNote: '$399/yr — save 32%',
    description: 'For authors and businesses at scale.',
    features: [
      '10 books per month',
      'Up to 15 chapters',
      'Everything in Standard',
      'Brand identity (logo, color, bio)',
      'Stripe Connect book sales (10% fee)',
      'Telegram lead notifications',
      'Custom social links',
    ],
    cta: 'Start Pro',
    ctaHref: '/signup',
    highlight: true,
  },
]

const COMPARISON = [
  { label: 'Books per month',    free: '1 (lifetime)', standard: '3', pro: '10' },
  { label: 'Max chapters',       free: '6',   standard: '8',    pro: '15' },
  { label: 'AI co-author',       free: true,  standard: true,   pro: true },
  { label: 'Chapter illustrations', free: true, standard: true, pro: true },
  { label: 'Flipbook preview',   free: true,  standard: true,   pro: true },
  { label: 'HTML export',        free: true,  standard: true,   pro: true },
  { label: 'PDF export',         free: false, standard: true,   pro: true },
  { label: 'Email gate publishing', free: true, standard: true, pro: true },
  { label: 'Lead capture',       free: false, standard: true,   pro: true },
  { label: 'MailerLite sync',    free: false, standard: true,   pro: true },
  { label: 'Brand identity',     free: false, standard: false,  pro: true },
  { label: 'Stripe book sales',  free: false, standard: false,  pro: true },
  { label: 'Telegram notifications', free: false, standard: false, pro: true },
  { label: 'Priority support',   free: false, standard: true,   pro: true },
]

function Cell({ value }: { value: boolean | string }) {
  if (typeof value === 'boolean') {
    return value
      ? <Check className="w-4 h-4 text-accent mx-auto" />
      : <span className="block text-center text-muted-foreground text-xs">—</span>
  }
  return <span className="text-xs font-inter text-cream/80 text-center block">{value}</span>
}

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-canvas text-cream">
      {/* Nav */}
      <header className="border-b border-[#2A2A2A] px-6 py-4 flex items-center justify-between sticky top-0 z-50 bg-canvas/95 backdrop-blur">
        <Link href="/" className="font-playfair text-xl text-cream hover:text-cream/80 transition-colors">
          FlipBookPro
        </Link>
        <nav className="flex items-center gap-4">
          <Link href="/login" className="text-sm font-inter text-muted-foreground hover:text-cream transition-colors">Sign in</Link>
          <Link href="/signup" className="px-4 py-2 bg-accent hover:bg-accent/90 text-cream font-inter text-sm font-semibold rounded-lg transition-colors">
            Get started free
          </Link>
        </nav>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-20">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-cream font-inter transition-colors mb-10">
          <ArrowLeft className="w-4 h-4" /> Home
        </Link>

        <div className="text-center mb-14">
          <h1 className="font-playfair text-4xl text-cream mb-3">Simple, transparent pricing</h1>
          <p className="text-muted-foreground font-source-serif text-sm max-w-md mx-auto">
            Start free and upgrade when you need more books or advanced features.
          </p>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`rounded-2xl border p-7 flex flex-col gap-5 ${
                plan.highlight ? 'border-accent bg-accent/5' : 'border-[#2A2A2A] bg-[#1A1A1A]'
              }`}
            >
              {plan.highlight && (
                <div className="inline-block self-start px-2 py-0.5 bg-accent text-cream text-xs font-inter font-semibold rounded uppercase tracking-widest">
                  Most popular
                </div>
              )}
              <div>
                <p className="font-inter font-semibold text-cream text-xs uppercase tracking-widest mb-2">{plan.name}</p>
                <div className="flex items-baseline gap-1 mb-0.5">
                  <span className="font-playfair text-3xl text-cream font-bold">{plan.price}</span>
                  <span className="font-inter text-sm text-muted-foreground">{plan.interval}</span>
                </div>
                <p className="text-xs font-inter text-muted-foreground">{plan.annualNote}</p>
              </div>
              <p className="text-xs font-source-serif text-muted-foreground">{plan.description}</p>
              <ul className="space-y-2.5 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs font-inter text-cream/70">
                    <Check className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={plan.ctaHref}
                className={`py-2.5 rounded-lg text-sm font-inter font-semibold text-center transition-colors ${
                  plan.highlight
                    ? 'bg-accent hover:bg-accent/90 text-cream'
                    : 'bg-[#2A2A2A] hover:bg-[#333] text-cream border border-[#333]'
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        {/* Comparison table */}
        <div>
          <h2 className="font-playfair text-2xl text-cream text-center mb-8">Full feature comparison</h2>
          <div className="border border-[#2A2A2A] rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#2A2A2A] bg-[#1A1A1A]">
                  <th className="text-left px-5 py-4 text-xs font-inter font-medium text-muted-foreground uppercase tracking-wider">Feature</th>
                  <th className="px-5 py-4 text-xs font-inter font-medium text-muted-foreground uppercase tracking-wider text-center">Free</th>
                  <th className="px-5 py-4 text-xs font-inter font-medium text-muted-foreground uppercase tracking-wider text-center">Standard</th>
                  <th className="px-5 py-4 text-xs font-inter font-medium text-accent uppercase tracking-wider text-center">Pro</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row, i) => (
                  <tr key={row.label} className={`border-b border-[#2A2A2A] last:border-b-0 ${i % 2 === 0 ? 'bg-canvas' : 'bg-[#1A1A1A]'}`}>
                    <td className="px-5 py-3 text-xs font-inter text-cream/70">{row.label}</td>
                    <td className="px-5 py-3"><Cell value={row.free} /></td>
                    <td className="px-5 py-3"><Cell value={row.standard} /></td>
                    <td className="px-5 py-3"><Cell value={row.pro} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-20 max-w-2xl mx-auto">
          <h2 className="font-playfair text-2xl text-cream text-center mb-10">Common questions</h2>
          <div className="space-y-6">
            {[
              {
                q: 'What counts as "one book"?',
                a: 'Each new book you create counts toward your monthly limit. You can edit and re-publish existing books without using additional quota.',
              },
              {
                q: 'Can I cancel anytime?',
                a: 'Yes. Cancel from the Billing page at any time. Your plan stays active until the end of the billing period.',
              },
              {
                q: 'What is the Stripe Connect book sales feature?',
                a: 'Pro users can charge readers directly for their book using Stripe. FlipBookPro takes a 10% platform fee. Payouts go straight to your Stripe account.',
              },
              {
                q: 'Do I own the content I create?',
                a: 'Yes. All content, illustrations, and exported files belong to you.',
              },
            ].map((item) => (
              <div key={item.q} className="border-b border-[#2A2A2A] pb-6">
                <h3 className="font-playfair text-base text-cream mb-2">{item.q}</h3>
                <p className="text-sm font-source-serif text-muted-foreground leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-20">
          <h2 className="font-playfair text-3xl text-cream mb-4">Ready to write your first book?</h2>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 px-6 py-3.5 bg-accent hover:bg-accent/90 text-cream font-inter font-semibold text-sm rounded-lg transition-colors"
          >
            Get started free
          </Link>
          <p className="text-xs font-inter text-muted-foreground mt-4">No credit card required.</p>
        </div>
      </main>

      <footer className="border-t border-[#2A2A2A] px-6 py-8 mt-16">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="font-playfair text-cream/60 text-sm">FlipBookPro</span>
          <nav className="flex gap-6 text-xs font-inter text-muted-foreground">
            <Link href="/" className="hover:text-cream transition-colors">Home</Link>
            <Link href="/login" className="hover:text-cream transition-colors">Sign in</Link>
            <Link href="/signup" className="hover:text-cream transition-colors">Sign up</Link>
          </nav>
          <p className="text-xs font-inter text-muted-foreground">© {new Date().getFullYear()} FlipBookPro</p>
        </div>
      </footer>
    </div>
  )
}
