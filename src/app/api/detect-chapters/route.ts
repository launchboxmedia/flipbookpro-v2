import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const { outline } = await req.json()

  if (!outline || typeof outline !== 'string') {
    return NextResponse.json({ error: 'outline required' }, { status: 400 })
  }

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: `Analyze this book outline and extract the chapters. Return a JSON array of objects with "title" and "brief" fields. The brief should be 1-2 sentences describing what the chapter covers. Extract only actual chapters — ignore front matter, prefaces, and appendices unless they are clearly main chapters. Return only the JSON array, no other text.

Outline:
${outline}`,
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''

  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) throw new Error('No JSON array found')
    const chapters = JSON.parse(jsonMatch[0])
    return NextResponse.json({ chapters })
  } catch {
    return NextResponse.json({ error: 'Failed to parse chapters' }, { status: 500 })
  }
}
