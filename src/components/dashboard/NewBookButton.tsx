'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { createBook } from '@/app/dashboard/actions'

export function NewBookButton() {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    await createBook()
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="flex items-center gap-2 px-4 py-2.5 bg-accent hover:bg-accent/90 text-cream font-inter text-sm font-medium rounded-md transition-colors disabled:opacity-60"
    >
      <Plus className="w-4 h-4" />
      {loading ? 'Creating...' : 'New Book'}
    </button>
  )
}
