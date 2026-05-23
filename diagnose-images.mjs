import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://rwodkwgpzuvzuhnvoeaq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3b2Rrd2dwenV2enVobnZvZWFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0NDUxNjgsImV4cCI6MjA5MjAyMTE2OH0.s9gUgDHB9w9BKrAlwpA5hPR0ekJUNTi7a_W3Mkpvnz8'
)

// Search for chapter with "Control Payment History" in the title
const { data: pages, error: pagesError } = await supabase
  .from('book_pages')
  .select('id, book_id, chapter_index, chapter_title, image_url')
  .ilike('chapter_title', '%Control Payment History%')
  .limit(5)

if (pagesError) {
  console.error('Error:', pagesError.message)
  process.exit(1)
}

if (!pages || pages.length === 0) {
  console.log('No chapters found with "Control Payment History"')
  process.exit(1)
}

console.log('Found chapter(s):\n')
const bookId = pages[0].book_id

pages.forEach(page => {
  console.log(`Chapter ${page.chapter_index + 1}: ${page.chapter_title}`)
  console.log(`  Book ID: ${page.book_id}`)
  console.log(`  Page ID: ${page.id}`)
  console.log(`  Image URL: ${page.image_url || 'NULL'}\n`)
})

// Get the book title
const { data: book } = await supabase
  .from('books')
  .select('title')
  .eq('id', bookId)
  .single()

console.log(`Book title: ${book?.title || 'Unknown'}\n`)

// Get ALL chapters for this book
const { data: allPages } = await supabase
  .from('book_pages')
  .select('chapter_index, chapter_title, image_url')
  .eq('book_id', bookId)
  .gte('chapter_index', 0)
  .order('chapter_index')

console.log('All chapters:\n')
allPages?.forEach(p => {
  const hasImage = p.image_url ? '✓' : '✗'
  console.log(`${hasImage} Chapter ${p.chapter_index + 1}: ${p.chapter_title}`)
})

process.exit(0)
