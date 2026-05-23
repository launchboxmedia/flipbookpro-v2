import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://rwodkwgpzuvzuhnvoeaq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3b2Rrd2dwenV2enVobnZvZWFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0NDUxNjgsImV4cCI6MjA5MjAyMTE2OH0.s9gUgDHB9w9BKrAlwpA5hPR0ekJUNTi7a_W3Mkpvnz8'
)

const bookId = 'ae24603d-e738-4912-a1fc-c11d80654932'

console.log('=== CHECKING BOOK: THE C.R.E.D.I.T. CLEANSE ===\n')

// Get the book info
const { data: book } = await supabase
  .from('books')
  .select('title')
  .eq('id', bookId)
  .single()

console.log(`Book title: ${book?.title || 'Not found'}\n`)

// Get all chapters
const { data: pages } = await supabase
  .from('book_pages')
  .select('chapter_index, chapter_title, image_url')
  .eq('book_id', bookId)
  .gte('chapter_index', 0)
  .order('chapter_index')

if (!pages || pages.length === 0) {
  console.log('No chapters found')
  process.exit(1)
}

console.log(`Total chapters: ${pages.length}\n`)
console.log('=== CHAPTER IMAGE STATUS ===\n')

for (const page of pages) {
  const hasUrl = page.image_url ? '✓' : '✗'
  console.log(`${hasUrl} Ch ${page.chapter_index + 1}: ${page.chapter_title}`)

  if (page.image_url) {
    // Extract the storage path from the public URL
    const match = page.image_url.match(/\/storage\/v1\/object\/public\/book-images\/(.+)$/)
    const storagePath = match ? match[1] : null

    if (storagePath) {
      // Check if file exists in storage
      const { data: fileData, error: fileError } = await supabase.storage
        .from('book-images')
        .list(storagePath.split('/').slice(0, -1).join('/'), {
          search: storagePath.split('/').pop()
        })

      const exists = fileData && fileData.length > 0
      const status = exists ? 'EXISTS' : 'NOT FOUND'

      console.log(`  Storage: ${status}`)
      console.log(`  Path: ${storagePath}`)

      if (!exists) {
        console.log(`  URL: ${page.image_url}`)
      }
    } else {
      console.log(`  ERROR: Could not parse storage path from URL`)
      console.log(`  URL: ${page.image_url}`)
    }
  }
  console.log()
}

process.exit(0)
