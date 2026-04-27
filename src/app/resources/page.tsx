'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Sparkles, Target, BookOpen } from 'lucide-react'

export default function ResourcesPage() {
  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-[#2A2A2A] px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Link href="/dashboard" className="text-cream/50 hover:text-cream transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="font-playfair text-2xl text-cream">Resources</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10 space-y-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[#222] border border-[#2A2A2A] rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-gold" />
              </div>
              <h2 className="font-playfair text-lg text-cream">Title Checker</h2>
            </div>
            <p className="text-cream/50 text-sm font-inter mb-5">
              Score your book title for clarity, intrigue, and market appeal.
            </p>
            <TitleChecker />
          </div>

          <div className="bg-[#222] border border-[#2A2A2A] rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                <Target className="w-5 h-5 text-accent" />
              </div>
              <h2 className="font-playfair text-lg text-cream">Niche Evaluator</h2>
            </div>
            <p className="text-cream/50 text-sm font-inter mb-5">
              Evaluate your niche for demand, competition, and monetization potential.
            </p>
            <NicheEvaluator />
          </div>
        </div>

        <div className="bg-[#222] border border-[#2A2A2A] rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-accent" />
            </div>
            <h2 className="font-playfair text-lg text-cream">Quick Start Guide</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm font-inter text-cream/70">
            <div className="space-y-2">
              <p className="text-gold font-medium">1. Create</p>
              <p>Use the wizard to set up your book outline, persona, and style preferences.</p>
            </div>
            <div className="space-y-2">
              <p className="text-gold font-medium">2. Build</p>
              <p>Co-Author mode generates and refines each chapter with AI assistance.</p>
            </div>
            <div className="space-y-2">
              <p className="text-gold font-medium">3. Publish</p>
              <p>Export as PDF or publish as an interactive flipbook with lead capture.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

function TitleChecker() {
  const [title, setTitle] = useState('')
  const [result, setResult] = useState<{ score: number; feedback: string } | null>(null)
  const [loading, setLoading] = useState(false)

  async function analyze() {
    if (!title.trim()) return
    setLoading(true)
    try {
      const res = await fetch('/api/resources/title-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      })
      const data = await res.json()
      setResult(data)
    } catch {
      setResult({ score: 0, feedback: 'Analysis failed. Please try again.' })
    }
    setLoading(false)
  }

  return (
    <div className="space-y-3">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Enter your book title..."
        className="w-full px-3 py-2 rounded-md bg-[#2A2A2A] border border-[#333] text-cream placeholder:text-cream/30 font-inter text-sm focus:outline-none focus:ring-2 focus:ring-gold/50"
      />
      <button
        onClick={analyze}
        disabled={loading || !title.trim()}
        className="px-4 py-2 bg-gold/20 hover:bg-gold/30 text-gold font-inter text-sm rounded-md transition-colors disabled:opacity-40"
      >
        {loading ? 'Analyzing...' : 'Check Title'}
      </button>
      {result && (
        <div className="p-3 rounded-md bg-[#1A1A1A] border border-[#333]">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-gold font-inter font-bold text-lg">{result.score}/10</span>
            <div className="flex-1 h-1.5 bg-[#333] rounded-full overflow-hidden">
              <div className="h-full bg-gold rounded-full transition-all" style={{ width: `${result.score * 10}%` }} />
            </div>
          </div>
          <p className="text-cream/60 text-sm font-inter">{result.feedback}</p>
        </div>
      )}
    </div>
  )
}

function NicheEvaluator() {
  const [niche, setNiche] = useState('')
  const [result, setResult] = useState<{ demand: string; competition: string; verdict: string } | null>(null)
  const [loading, setLoading] = useState(false)

  async function evaluate() {
    if (!niche.trim()) return
    setLoading(true)
    try {
      const res = await fetch('/api/resources/niche-eval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ niche }),
      })
      const data = await res.json()
      setResult(data)
    } catch {
      setResult({ demand: 'Unknown', competition: 'Unknown', verdict: 'Evaluation failed.' })
    }
    setLoading(false)
  }

  return (
    <div className="space-y-3">
      <input
        value={niche}
        onChange={(e) => setNiche(e.target.value)}
        placeholder="e.g., productivity for remote workers"
        className="w-full px-3 py-2 rounded-md bg-[#2A2A2A] border border-[#333] text-cream placeholder:text-cream/30 font-inter text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
      />
      <button
        onClick={evaluate}
        disabled={loading || !niche.trim()}
        className="px-4 py-2 bg-accent/20 hover:bg-accent/30 text-accent font-inter text-sm rounded-md transition-colors disabled:opacity-40"
      >
        {loading ? 'Evaluating...' : 'Evaluate Niche'}
      </button>
      {result && (
        <div className="p-3 rounded-md bg-[#1A1A1A] border border-[#333] space-y-2">
          <div className="flex gap-4 text-sm font-inter">
            <span className="text-cream/40">Demand:</span>
            <span className="text-cream/80">{result.demand}</span>
          </div>
          <div className="flex gap-4 text-sm font-inter">
            <span className="text-cream/40">Competition:</span>
            <span className="text-cream/80">{result.competition}</span>
          </div>
          <p className="text-cream/60 text-sm font-inter pt-1 border-t border-[#333]">{result.verdict}</p>
        </div>
      )}
    </div>
  )
}
