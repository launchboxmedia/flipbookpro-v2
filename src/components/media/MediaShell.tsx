'use client'

import { useState } from 'react'
import { Eye, Trash2, X, ImageIcon, Check, ChevronDown } from 'lucide-react'

export interface MediaImage {
  storageKey: string
  publicUrl: string
  bookId: string
  bookTitle: string
  type: 'cover' | 'chapter' | 'back-cover'
  inUse: boolean
  createdAt: string
  sizeBytes: number
}

export interface BookStub {
  id: string
  title: string
}

export interface ChapterStub {
  chapter_index: number
  chapter_title: string
}

interface Props {
  images: MediaImage[]
  books: BookStub[]
  chaptersByBook: Record<string, ChapterStub[]>
}

type TypeFilter = 'all' | 'cover' | 'chapter' | 'back-cover'

const TYPE_LABELS: Record<TypeFilter, string> = {
  all: 'All',
  cover: 'Covers',
  chapter: 'Chapters',
  'back-cover': 'Back Covers',
}

const TYPE_BADGE: Record<MediaImage['type'], string> = {
  cover: 'bg-gold/20 text-gold',
  chapter: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  'back-cover': 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
}

const TYPE_LABEL: Record<MediaImage['type'], string> = {
  cover: 'Cover',
  chapter: 'Chapter',
  'back-cover': 'Back Cover',
}

function formatBytes(bytes: number) {
  if (bytes === 0) return '—'
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatTotalMB(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(0)} MB`
}

function formatDate(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function MediaShell({ images: initialImages, books, chaptersByBook }: Props) {
  const [images, setImages] = useState<MediaImage[]>(initialImages)
  const [selectedBookId, setSelectedBookId] = useState<string>('all')
  const [selectedType, setSelectedType] = useState<TypeFilter>('all')
  const [selectedImage, setSelectedImage] = useState<MediaImage | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<MediaImage | null>(null)
  const [assignTarget, setAssignTarget] = useState<MediaImage | null>(null)
  const [assignBookId, setAssignBookId] = useState<string>('')
  const [assignChapterIndex, setAssignChapterIndex] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [assignError, setAssignError] = useState('')
  const [deleteError, setDeleteError] = useState('')

  const visible = images.filter((img) => {
    if (selectedBookId !== 'all' && img.bookId !== selectedBookId) return false
    if (selectedType !== 'all' && img.type !== selectedType) return false
    return true
  })

  const totalMB = images.reduce((s, img) => s + img.sizeBytes, 0)

  async function handleDelete(img: MediaImage) {
    setDeleting(true)
    setDeleteError('')
    try {
      const res = await fetch('/api/media/delete-image', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storageKey: img.storageKey }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? `Delete failed (${res.status})`)
      setImages((prev) => prev.filter((i) => i.storageKey !== img.storageKey))
      setConfirmDelete(null)
      if (selectedImage?.storageKey === img.storageKey) setSelectedImage(null)
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  async function handleAssign() {
    if (!assignTarget || !assignBookId) return
    if (assignTarget.type === 'chapter' && assignChapterIndex === null) return
    setAssigning(true)
    setAssignError('')
    try {
      const res = await fetch('/api/media/assign-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storageKey: assignTarget.storageKey,
          publicUrl: assignTarget.publicUrl,
          bookId: assignBookId,
          chapterIndex: assignTarget.type === 'chapter' ? assignChapterIndex : null,
          type: assignTarget.type === 'back-cover' ? 'back-cover' : assignTarget.type === 'cover' ? 'cover' : 'chapter',
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? `Assign failed (${res.status})`)
      // Mark image as in-use
      setImages((prev) =>
        prev.map((i) =>
          i.storageKey === assignTarget.storageKey ? { ...i, inUse: true, bookId: assignBookId } : i,
        ),
      )
      setAssignTarget(null)
      setAssignBookId('')
      setAssignChapterIndex(null)
    } catch (e) {
      setAssignError(e instanceof Error ? e.message : 'Assign failed')
    } finally {
      setAssigning(false)
    }
  }

  function openAssign(img: MediaImage) {
    setAssignTarget(img)
    setAssignBookId(books[0]?.id ?? '')
    setAssignChapterIndex(null)
    setAssignError('')
    setSelectedImage(null)
  }

  const assignChapters = assignBookId ? (chaptersByBook[assignBookId] ?? []) : []

  return (
    <div className="min-h-screen bg-cream-1 dark:bg-ink-1">
      <div className="max-w-7xl mx-auto px-6 py-10">

        {/* Header */}
        <div className="mb-8">
          <h1 className="font-playfair text-3xl text-ink-1 dark:text-white mb-1">Media Library</h1>
          <p className="text-sm font-inter text-ink-1/50 dark:text-white/40">
            {formatTotalMB(totalMB)} across {images.length} image{images.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          {/* Book filter */}
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setSelectedBookId('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-inter font-medium transition-colors ${
                selectedBookId === 'all'
                  ? 'bg-gold text-ink-1'
                  : 'bg-cream-2 dark:bg-ink-3 text-ink-1/60 dark:text-white/50 hover:text-ink-1 dark:hover:text-white'
              }`}
            >
              All Books
            </button>
            {books.map((b) => (
              <button
                key={b.id}
                onClick={() => setSelectedBookId(b.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-inter font-medium transition-colors truncate max-w-[160px] ${
                  selectedBookId === b.id
                    ? 'bg-gold text-ink-1'
                    : 'bg-cream-2 dark:bg-ink-3 text-ink-1/60 dark:text-white/50 hover:text-ink-1 dark:hover:text-white'
                }`}
              >
                {b.title}
              </button>
            ))}
          </div>

          {/* Separator */}
          <div className="w-px bg-cream-3 dark:bg-ink-3 self-stretch" />

          {/* Type filter */}
          <div className="flex gap-1.5">
            {(Object.keys(TYPE_LABELS) as TypeFilter[]).map((t) => (
              <button
                key={t}
                onClick={() => setSelectedType(t)}
                className={`px-3 py-1.5 rounded-full text-xs font-inter font-medium transition-colors ${
                  selectedType === t
                    ? 'bg-ink-1 dark:bg-white text-white dark:text-ink-1'
                    : 'bg-cream-2 dark:bg-ink-3 text-ink-1/60 dark:text-white/50 hover:text-ink-1 dark:hover:text-white'
                }`}
              >
                {TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        {/* Count */}
        <p className="text-xs font-inter text-ink-1/40 dark:text-white/30 mb-4">
          {visible.length} image{visible.length !== 1 ? 's' : ''}
        </p>

        {/* Grid */}
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-40 text-center">
            <ImageIcon className="w-10 h-10 text-ink-1/20 dark:text-white/20 mb-4" />
            <p className="font-playfair text-lg text-ink-1/40 dark:text-white/40">No images found</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {visible.map((img) => (
              <div
                key={img.storageKey}
                className="group relative bg-white dark:bg-ink-2 rounded-xl overflow-hidden border border-cream-3 dark:border-ink-3 hover:border-gold/50 transition-all cursor-pointer"
              >
                {/* Thumbnail */}
                <div className="aspect-square relative bg-cream-2 dark:bg-ink-3">
                  <img
                    src={img.publicUrl}
                    alt={img.bookTitle}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  {/* Hover actions */}
                  <div className="absolute inset-0 bg-ink-1/30 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setSelectedImage(img)}
                      className="w-7 h-7 flex items-center justify-center rounded-md bg-white/90 hover:bg-white text-ink-1 transition-colors"
                      title="Preview"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setConfirmDelete(img)}
                      className="w-7 h-7 flex items-center justify-center rounded-md bg-white/90 hover:bg-red-500 text-ink-1 hover:text-white transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Card footer */}
                <div className="px-2 py-2">
                  <p className="text-[11px] font-inter text-ink-1/50 dark:text-white/30 truncate">{img.bookTitle}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={`text-[9px] font-inter font-semibold uppercase px-1.5 py-0.5 rounded ${TYPE_BADGE[img.type]}`}>
                      {TYPE_LABEL[img.type]}
                    </span>
                    {img.inUse && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" title="In use" />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Preview modal ─────────────────────────────────────────── */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80"
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedImage(null) }}
        >
          <div className="relative bg-white dark:bg-ink-2 rounded-2xl overflow-hidden shadow-2xl max-w-2xl w-full">
            {/* Close */}
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-ink-1/10 hover:bg-ink-1/20 dark:bg-white/10 dark:hover:bg-white/20 text-ink-1 dark:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Image */}
            <div className="bg-cream-2 dark:bg-ink-3 flex items-center justify-center p-4" style={{ maxHeight: '65vh' }}>
              <img
                src={selectedImage.publicUrl}
                alt={selectedImage.bookTitle}
                className="max-h-[60vh] w-auto object-contain rounded-lg"
              />
            </div>

            {/* Meta + actions */}
            <div className="p-5">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mb-5">
                <div>
                  <p className="text-[10px] font-inter uppercase tracking-wider text-ink-1/40 dark:text-white/30 mb-0.5">Book</p>
                  <p className="font-inter font-medium text-ink-1 dark:text-white truncate">{selectedImage.bookTitle}</p>
                </div>
                <div>
                  <p className="text-[10px] font-inter uppercase tracking-wider text-ink-1/40 dark:text-white/30 mb-0.5">Type</p>
                  <p className="font-inter text-ink-1 dark:text-white">{TYPE_LABEL[selectedImage.type]}</p>
                </div>
                <div>
                  <p className="text-[10px] font-inter uppercase tracking-wider text-ink-1/40 dark:text-white/30 mb-0.5">Size</p>
                  <p className="font-inter text-ink-1 dark:text-white">{formatBytes(selectedImage.sizeBytes)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-inter uppercase tracking-wider text-ink-1/40 dark:text-white/30 mb-0.5">In use</p>
                  <p className={`font-inter font-medium ${selectedImage.inUse ? 'text-emerald-600' : 'text-ink-1/40 dark:text-white/30'}`}>
                    {selectedImage.inUse ? 'Yes' : 'No'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-inter uppercase tracking-wider text-ink-1/40 dark:text-white/30 mb-0.5">Created</p>
                  <p className="font-inter text-ink-1 dark:text-white">{formatDate(selectedImage.createdAt)}</p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => openAssign(selectedImage)}
                  className="flex-1 py-2 rounded-lg bg-gold hover:bg-gold-soft text-ink-1 text-sm font-inter font-medium transition-colors"
                >
                  Assign to book
                </button>
                <button
                  onClick={() => { setConfirmDelete(selectedImage); setSelectedImage(null) }}
                  className="py-2 px-4 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-950/50 text-red-600 dark:text-red-400 text-sm font-inter transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Assign picker modal ───────────────────────────────────── */}
      {assignTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/70"
          onClick={(e) => { if (e.target === e.currentTarget) setAssignTarget(null) }}
        >
          <div className="bg-white dark:bg-ink-2 rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-playfair text-lg text-ink-1 dark:text-white">Assign Image</h2>
              <button onClick={() => setAssignTarget(null)} className="text-ink-1/40 hover:text-ink-1 dark:text-white/40 dark:hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Thumbnail preview */}
            <div className="w-20 h-20 rounded-lg overflow-hidden bg-cream-2 dark:bg-ink-3 mb-5">
              <img src={assignTarget.publicUrl} alt="" className="w-full h-full object-cover" />
            </div>

            {/* Book selector */}
            <label className="block mb-4">
              <span className="text-xs font-inter font-medium text-ink-1/60 dark:text-white/50 uppercase tracking-wider mb-1.5 block">Select book</span>
              <div className="relative">
                <select
                  value={assignBookId}
                  onChange={(e) => { setAssignBookId(e.target.value); setAssignChapterIndex(null) }}
                  className="w-full appearance-none bg-cream-1 dark:bg-ink-3 border border-cream-3 dark:border-ink-4 rounded-lg px-3 py-2.5 text-sm font-inter text-ink-1 dark:text-white pr-8 focus:outline-none focus:border-gold"
                >
                  {books.map((b) => (
                    <option key={b.id} value={b.id}>{b.title}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-1/40 pointer-events-none" />
              </div>
            </label>

            {/* Chapter selector (only for chapter type) */}
            {assignTarget.type === 'chapter' && assignChapters.length > 0 && (
              <fieldset className="mb-5">
                <legend className="text-xs font-inter font-medium text-ink-1/60 dark:text-white/50 uppercase tracking-wider mb-2 block">Select chapter</legend>
                <div className="max-h-48 overflow-y-auto space-y-1 border border-cream-3 dark:border-ink-3 rounded-lg p-2">
                  {assignChapters.map((ch) => (
                    <label key={ch.chapter_index} className="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-cream-2 dark:hover:bg-ink-3 cursor-pointer">
                      <input
                        type="radio"
                        name="chapter"
                        value={ch.chapter_index}
                        checked={assignChapterIndex === ch.chapter_index}
                        onChange={() => setAssignChapterIndex(ch.chapter_index)}
                        className="accent-gold"
                      />
                      <span className="text-sm font-inter text-ink-1 dark:text-white">
                        Chapter {ch.chapter_index + 1}: {ch.chapter_title}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            {/* Assign to cover/back-cover hint */}
            {(assignTarget.type === 'cover' || assignTarget.type === 'back-cover') && (
              <p className="text-xs font-inter text-ink-1/50 dark:text-white/40 mb-5">
                This image will be set as the {assignTarget.type === 'cover' ? 'front cover' : 'back cover'} of the selected book.
              </p>
            )}

            {assignError && (
              <p className="text-xs text-red-500 mb-3">{assignError}</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setAssignTarget(null)}
                className="flex-1 py-2.5 rounded-lg border border-cream-3 dark:border-ink-3 text-sm font-inter text-ink-1/60 dark:text-white/50 hover:text-ink-1 dark:hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAssign}
                disabled={
                  assigning ||
                  !assignBookId ||
                  (assignTarget.type === 'chapter' && assignChapterIndex === null)
                }
                className="flex-1 py-2.5 rounded-lg bg-gold hover:bg-gold-soft disabled:opacity-50 text-ink-1 text-sm font-inter font-medium transition-colors flex items-center justify-center gap-2"
              >
                {assigning ? (
                  <span>Assigning…</span>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Assign Image
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirm ────────────────────────────────────────── */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/70"
          onClick={(e) => { if (e.target === e.currentTarget) { setConfirmDelete(null); setDeleteError('') } }}
        >
          <div className="bg-white dark:bg-ink-2 rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h2 className="font-playfair text-lg text-ink-1 dark:text-white mb-2">Delete image?</h2>
            <p className="text-sm font-inter text-ink-1/60 dark:text-white/50 mb-1">
              This will permanently remove the image from storage.
            </p>
            {confirmDelete.inUse && (
              <p className="text-xs font-inter text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-lg px-3 py-2 mb-4">
                This image is currently in use. Deleting it will remove it from the book.
              </p>
            )}
            {deleteError && (
              <p className="text-xs text-red-500 mb-3">{deleteError}</p>
            )}
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => { setConfirmDelete(null); setDeleteError('') }}
                className="flex-1 py-2.5 rounded-lg border border-cream-3 dark:border-ink-3 text-sm font-inter text-ink-1/60 dark:text-white/50 hover:text-ink-1 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-lg bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-inter font-medium transition-colors"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
