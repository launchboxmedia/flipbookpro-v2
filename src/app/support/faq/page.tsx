'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

const FAQS = [
  {
    q: 'How many books can I create?',
    a: 'The Free plan allows 1 book lifetime. Standard gives you 3 books per month, and Pro gives you 10 books per month. Upgrade from the Billing page.',
  },
  {
    q: 'Can I edit my book after it\'s been generated?',
    a: 'Yes — you can re-run the wizard to update your book settings, then regenerate drafts for any chapter. Your previously approved content is preserved unless you explicitly regenerate it.',
  },
  {
    q: 'How do I add my own cover image?',
    a: 'In the book editor (coauthor view), click the Upload button in the Cover section of the left sidebar. You can upload any JPG or PNG image.',
  },
  {
    q: 'What is the Human Score™ feature?',
    a: 'Human Score™ tells the AI to write in a more natural, varied style — breaking predictable patterns, avoiding common AI phrases, and varying sentence rhythm. This makes your content pass most AI detection filters.',
  },
  {
    q: 'How does the email gate work?',
    a: 'When you publish with an email gate, readers must enter their email to unlock your flipbook. Those emails are captured in your lead list and optionally synced to MailerLite on the Pro plan.',
  },
  {
    q: 'Can I export my book as a PDF?',
    a: 'PDF export is available on the Standard and Pro plans. You can also export as HTML on all plans. Find export options under Review & Export in the book editor.',
  },
  {
    q: 'What AI model writes my chapters?',
    a: 'FlipBookPro uses Claude Sonnet by Anthropic — one of the best models for long-form, structured writing. Your persona, vibe, tone, and reader-level settings all shape the output.',
  },
  {
    q: 'How do I contact support?',
    a: 'Email us at support@launchboxmedia.com. Pro members also get access to live chat. We typically reply within 24 hours.',
  },
]

export default function FAQPage() {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <div className="px-8 py-10 max-w-2xl mx-auto">
      <div className="mb-8">
        <h2 className="font-playfair text-3xl text-cream">FAQ</h2>
        <p className="text-muted-foreground text-sm font-source-serif mt-1">
          Answers to the most common questions.
        </p>
      </div>

      <div className="space-y-2">
        {FAQS.map((faq, i) => (
          <div key={i} className="bg-[#222] border border-[#333] rounded-xl overflow-hidden">
            <button
              onClick={() => setOpen(open === i ? null : i)}
              className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
            >
              <span className="font-inter font-medium text-cream text-sm">{faq.q}</span>
              <ChevronDown
                className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${open === i ? 'rotate-180' : ''}`}
              />
            </button>
            {open === i && (
              <div className="px-5 pb-4 border-t border-[#2A2A2A]">
                <p className="text-muted-foreground text-sm font-source-serif leading-relaxed pt-3">{faq.a}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
