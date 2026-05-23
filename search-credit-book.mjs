import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://rwodkwgpzuvzuhnvoeaq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3b2Rrd2dwenV2enVobnZvZWFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0NDUxNjgsImV4cCI6MjA5MjAyMTE2OH0.s9gUgDHB9w9BKrAlwpA5hPR0ekJUNTi7a_W3Mkpvnz8'
)

console.log('Searching for books with CREDIT or CLEANSE...\n')

const { data: books, error } = await supabase
  .from('books')
  .select('id, title, created_at, user_id')
  .or('title.ilike.%CREDIT%,title.ilike.%CLEANSE%')
  .order('created_at', { ascending: false })
  .limit(10)

if (error) {
  console.error('Error:', error.message)
  process.exit(1)
}

if (!books || books.length === 0) {
  console.log('No books found with CREDIT or CLEANSE in title')
  console.log('\nSearching ALL books instead...\n')

  const { data: allBooks } = await supabase
    .from('books')
    .select('id, title, created_at')
    .order('created_at', { ascending: false })
    .limit(20)

  allBooks?.forEach((book, i) => {
    console.log(`${i + 1}. ${book.title}`)
    console.log(`   ID: ${book.id}`)
    console.log(`   Created: ${new Date(book.created_at).toLocaleString()}`)
    console.log()
  })
} else {
  console.log(`Found ${books.length} matching books:\n`)
  books.forEach((book, i) => {
    console.log(`${i + 1}. ${book.title}`)
    console.log(`   ID: ${book.id}`)
    console.log(`   Created: ${new Date(book.created_at).toLocaleString()}`)
    console.log()
  })
}

process.exit(0)
