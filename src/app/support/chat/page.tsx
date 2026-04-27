import { MessageCircle, Mail, ExternalLink } from 'lucide-react'

export const metadata = { title: 'Chat Support — FlipBookPro' }

export default function SupportChatPage() {
  return (
    <div className="px-8 py-10 max-w-2xl mx-auto">
      <div className="mb-8">
        <h2 className="font-playfair text-3xl text-cream">Chat Support</h2>
        <p className="text-muted-foreground text-sm font-source-serif mt-1">
          Get help from the FlipBookPro team.
        </p>
      </div>

      <div className="space-y-4">
        <a
          href="mailto:support@launchboxmedia.com"
          className="flex items-center gap-4 p-5 bg-[#222] border border-[#333] rounded-xl hover:border-[#444] transition-colors group"
        >
          <div className="w-10 h-10 rounded-lg bg-accent/15 flex items-center justify-center shrink-0">
            <Mail className="w-5 h-5 text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-inter font-medium text-cream text-sm">Email Support</p>
            <p className="text-muted-foreground text-xs font-source-serif mt-0.5">
              support@launchboxmedia.com · We reply within 24 hours
            </p>
          </div>
          <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-cream transition-colors shrink-0" />
        </a>

        <div className="flex items-center gap-4 p-5 bg-[#222] border border-[#333] rounded-xl">
          <div className="w-10 h-10 rounded-lg bg-[#2A2A2A] flex items-center justify-center shrink-0">
            <MessageCircle className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <p className="font-inter font-medium text-cream text-sm">Live Chat</p>
            <p className="text-muted-foreground text-xs font-source-serif mt-0.5">
              Available for Pro plan members — upgrade to unlock real-time support.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
