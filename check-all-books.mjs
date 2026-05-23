import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://rwodkwgpzuvzuhnvoeaq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3b2Rrd2dwenV2enVobnZvZWFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0NDUxNjgsImV4cCI6MjA5MjAyMTE2OH0.s9gUgDHB9w9BKrAlwpA5hPR0ekJUNTi7a_W3Mkpvnz8'
)

const bookIds = [
  '0ff81a65-6239-43e6-8a9e-c114234ac9e8',  // From Tryouts to Game Day
  '80e541b0-c950-4b94-896a-d18bd8badc8e',  // The Funding Broker's TikTok Playbook
  '94c42946-a631-4eb8-9cde-4eada8fab9ca',  // First Week: The New Dog Owner's Survival Guide
]

for (const bookId of bookIds) {
  const { data: book } = await supabase
    .from('books')
    .select('title')
    .eq('id', bookId)
    .single()

  const { data: pages } = await supabase
    .from('book_pages')
    .select('chapter_index, chapter_title, image_url')
    .eq('book_id', bookId)
    .gte('chapter_index', 0)
    .order('chapter_index')

  console.log(`\n=== ${book.title} ===`)
  console.log(`Total chapters: ${pages?.length || 0}\n`)

  if (pages && pages.length >= 12) {
    pages.forEach(p => {
      const hasImage = p.image_url ? '✓' : '✗'
      console.log(`${hasImage} Ch ${p.chapter_index + 1}: ${p.chapter_title}`)
    })
  } else if (pages) {
    console.log('(Less than 12 chapters)')
  }
}

process.exit(0)
