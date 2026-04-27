import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { BookOpen, Sparkles, Globe, Users, ArrowRight, Check, Layers, Zap } from 'lucide-react'

export const metadata = {
  title: 'FlipBookPro — AI-Powered Flipbooks for Authors',
  description: 'Turn your ideas into beautifully illustrated flipbooks in minutes. AI-assisted writing, stunning visuals, and one-click publishing.',
  robots: { index: true, follow: true },
  alternates: { canonical: process.env.NEXT_PUBLIC_APP_URL ?? '/' },
  openGraph: {
    title: 'FlipBookPro — AI-Powered Flipbooks for Authors',
    description: 'Turn your ideas into beautifully illustrated flipbooks in minutes.',
    type: 'website',
    url: process.env.NEXT_PUBLIC_APP_URL,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FlipBookPro — AI-Powered Flipbooks for Authors',
    description: 'Turn your ideas into beautifully illustrated flipbooks in minutes.',
  },
}

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-canvas text-cream overflow-hidden">
      {/* Nav */}
      <header className="border-b border-[#2A2A2A] px-6 py-4 flex items-center justify-between sticky top-0 z-50 bg-canvas/95 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent to-accent/60 flex items-center justify-center">
            <BookOpen className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-playfair text-xl text-cream">FlipBookPro</span>
        </div>
        <nav className="flex items-center gap-6">
          <Link href="/pricing" className="text-sm font-inter text-cream/50 hover:text-cream transition-colors hidden sm:block">
            Pricing
          </Link>
          <Link href="/resources" className="text-sm font-inter text-cream/50 hover:text-cream transition-colors hidden sm:block">
            Resources
          </Link>
          <Link href="/login" className="text-sm font-inter text-cream/50 hover:text-cream transition-colors">
            Sign in
          </Link>
          <Link
            href="/signup"
            className="px-4 py-2 bg-accent hover:bg-accent/90 text-cream font-inter text-sm font-semibold rounded-lg transition-colors"
          >
            Get started free
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative">
        {/* Background texture */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(74,124,89,0.08)_0%,transparent_70%)]" />
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-[radial-gradient(circle,rgba(201,168,76,0.04)_0%,transparent_60%)] pointer-events-none" />

        <div className="max-w-4xl mx-auto px-6 pt-28 pb-24 text-center relative">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 border border-[#333] rounded-full text-xs font-inter text-cream/50 mb-8 backdrop-blur-sm">
            <Sparkles className="w-3 h-3 text-gold" />
            Powered by Claude AI &amp; Gemini
          </div>
          <h1 className="font-playfair text-5xl sm:text-[3.5rem] md:text-6xl text-cream leading-[1.08] mb-6 text-balance tracking-tight">
            Your ideas, turned into
            <br />
            <span className="relative">
              <span className="text-gold italic">beautiful flipbooks</span>
              <span className="absolute -bottom-1 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
            </span>
          </h1>
          <p className="font-source-serif text-lg text-cream/50 max-w-2xl mx-auto mb-10 leading-relaxed">
            Write with an AI co-author that matches your voice. Generate chapter illustrations,
            build a stunning interactive flipbook, and publish with an email gate — all in one flow.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/signup"
              className="group flex items-center justify-center gap-2 px-7 py-3.5 bg-accent hover:bg-accent/90 text-cream font-inter font-semibold text-sm rounded-lg transition-all shadow-[0_4px_20px_rgba(74,124,89,0.25)] hover:shadow-[0_8px_30px_rgba(74,124,89,0.35)]"
            >
              Create your first book free
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/pricing"
              className="px-7 py-3.5 border border-[#333] hover:border-[#444] text-cream/60 hover:text-cream font-inter text-sm rounded-lg transition-colors"
            >
              See pricing
            </Link>
          </div>
          <p className="text-[11px] font-inter text-cream/30 mt-5 tracking-wide">No credit card required · Free forever plan available</p>
        </div>
      </section>

      {/* Feature strip */}
      <section className="border-t border-[#2A2A2A] bg-[#131313]">
        <div className="max-w-5xl mx-auto px-6 py-20 grid grid-cols-1 sm:grid-cols-3 gap-12">
          {[
            {
              icon: <Sparkles className="w-5 h-5 text-gold" />,
              title: 'AI Co-Author',
              body: 'Claude writes chapter by chapter, matching your persona and voice. Review, edit, approve — then move on.',
            },
            {
              icon: <Layers className="w-5 h-5 text-gold" />,
              title: 'Illustrated Flipbook',
              body: 'Every chapter gets a full-spread AI illustration. Flip through your book in a cinematic reader, ready to share.',
            },
            {
              icon: <Globe className="w-5 h-5 text-gold" />,
              title: 'Publish with Lead Gate',
              body: 'Publish with a one-click email gate. Grow your list automatically as readers unlock your book.',
            },
          ].map((f) => (
            <div key={f.title} className="space-y-3">
              <div className="w-10 h-10 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl flex items-center justify-center">
                {f.icon}
              </div>
              <h3 className="font-playfair text-lg text-cream">{f.title}</h3>
              <p className="text-sm font-source-serif text-cream/45 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-3xl mx-auto px-6 py-24">
        <p className="text-[10px] font-inter font-semibold text-gold/60 uppercase tracking-[0.2em] mb-3 text-center">How it works</p>
        <h2 className="font-playfair text-3xl text-cream text-center mb-16">From idea to published book in four steps</h2>
        <div className="space-y-12">
          {[
            { step: '01', title: 'Set your brief', body: 'Give FlipBookPro a topic, persona, and visual style. In seconds the AI drafts a full chapter outline.', icon: <Zap className="w-4 h-4" /> },
            { step: '02', title: 'Write with AI', body: 'Chapter by chapter, Claude writes and you approve. Edit freely — the AI adapts to your tone.', icon: <Sparkles className="w-4 h-4" /> },
            { step: '03', title: 'Generate illustrations', body: 'Approve all chapters and generate one stunning image per chapter. Or upload your own.', icon: <Layers className="w-4 h-4" /> },
            { step: '04', title: 'Publish & grow', body: 'Flip through the preview, set up an email gate, and publish a shareable link. Leads captured automatically.', icon: <Globe className="w-4 h-4" /> },
          ].map((item) => (
            <div key={item.step} className="flex gap-6 items-start group">
              <div className="w-10 h-10 rounded-full border border-[#333] bg-[#1A1A1A] flex items-center justify-center text-gold/50 shrink-0 group-hover:border-gold/30 transition-colors">
                {item.icon}
              </div>
              <div>
                <div className="flex items-baseline gap-3 mb-1.5">
                  <span className="font-inter text-[10px] font-bold text-gold/40 tracking-[0.15em]">{item.step}</span>
                  <h3 className="font-playfair text-xl text-cream">{item.title}</h3>
                </div>
                <p className="text-sm font-source-serif text-cream/45 leading-relaxed">{item.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing preview */}
      <section className="border-t border-[#2A2A2A] bg-[#131313]">
        <div className="max-w-4xl mx-auto px-6 py-24 text-center">
          <p className="text-[10px] font-inter font-semibold text-gold/60 uppercase tracking-[0.2em] mb-3">Pricing</p>
          <h2 className="font-playfair text-3xl text-cream mb-4">Simple, transparent pricing</h2>
          <p className="text-cream/40 font-source-serif text-sm mb-12">Start free. Upgrade when you need more books.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-10">
            {[
              { name: 'Free', price: '$0', desc: 'forever', features: ['1 book lifetime', 'Up to 6 chapters', 'HTML export', 'Email gate publishing'] },
              { name: 'Standard', price: '$9', desc: '/month', features: ['3 books per month', 'Up to 8 chapters', 'PDF + HTML export', 'Lead capture + MailerLite'], highlight: false },
              { name: 'Pro', price: '$49', desc: '/month', features: ['10 books per month', 'Up to 15 chapters', 'Stripe book sales', 'Brand identity', 'Telegram alerts'], highlight: true },
            ].map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl border p-6 text-left transition-all ${plan.highlight ? 'border-accent/40 bg-accent/5 shadow-[0_0_40px_rgba(74,124,89,0.08)]' : 'border-[#2A2A2A] bg-[#181818]'}`}
              >
                <p className="font-inter font-semibold text-[11px] text-cream/60 uppercase tracking-[0.15em] mb-1">{plan.name}</p>
                <div className="flex items-baseline gap-1 mb-5">
                  <span className="font-playfair text-3xl text-cream font-bold">{plan.price}</span>
                  <span className="text-cream/30 text-sm font-inter">{plan.desc}</span>
                </div>
                <ul className="space-y-2.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs font-inter text-cream/60">
                      <Check className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <Link href="/pricing" className="text-sm font-inter text-cream/40 hover:text-cream transition-colors underline underline-offset-4 decoration-cream/20">
            Compare all features →
          </Link>
        </div>
      </section>

      {/* Social proof / CTA */}
      <section className="relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(201,168,76,0.04)_0%,transparent_60%)]" />
        <div className="max-w-3xl mx-auto px-6 py-24 text-center relative">
          <div className="w-12 h-12 rounded-full bg-gold/5 border border-gold/10 flex items-center justify-center mx-auto mb-6">
            <Users className="w-5 h-5 text-gold/40" />
          </div>
          <h2 className="font-playfair text-3xl text-cream mb-4">Built for authors, coaches, and creators</h2>
          <p className="font-source-serif text-cream/40 text-sm max-w-xl mx-auto mb-10 leading-relaxed">
            Whether you&apos;re writing a lead magnet, a signature framework, or a short-form ebook — FlipBookPro handles the writing, the visuals, and the publishing so you can focus on your ideas.
          </p>
          <Link
            href="/signup"
            className="group inline-flex items-center gap-2 px-7 py-3.5 bg-accent hover:bg-accent/90 text-cream font-inter font-semibold text-sm rounded-lg transition-all shadow-[0_4px_20px_rgba(74,124,89,0.25)]"
          >
            Start writing for free
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#2A2A2A] px-6 py-8">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-gradient-to-br from-accent to-accent/60 flex items-center justify-center">
              <BookOpen className="w-2.5 h-2.5 text-white" />
            </div>
            <span className="font-playfair text-cream/40 text-sm">FlipBookPro</span>
          </div>
          <nav className="flex gap-6 text-xs font-inter text-cream/30">
            <Link href="/pricing" className="hover:text-cream/60 transition-colors">Pricing</Link>
            <Link href="/resources" className="hover:text-cream/60 transition-colors">Resources</Link>
            <Link href="/support" className="hover:text-cream/60 transition-colors">Support</Link>
            <Link href="/login" className="hover:text-cream/60 transition-colors">Sign in</Link>
          </nav>
          <p className="text-[11px] font-inter text-cream/20">© {new Date().getFullYear()} LaunchBox Media</p>
        </div>
      </footer>
    </div>
  )
}
