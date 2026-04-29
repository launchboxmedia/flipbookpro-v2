'use client'

import { motion } from 'framer-motion'
import { BookMarked, Wrench, Globe } from 'lucide-react'

interface Props {
  total: number
  inProgress: number
  published: number
}

const TILES = [
  { key: 'total',      label: 'Total books',  icon: BookMarked, accent: 'text-cream'  },
  { key: 'inProgress', label: 'In progress',  icon: Wrench,     accent: 'text-gold'   },
  { key: 'published',  label: 'Published',    icon: Globe,      accent: 'text-accent' },
] as const

export function StatsRow({ total, inProgress, published }: Props) {
  const values: Record<typeof TILES[number]['key'], number> = { total, inProgress, published }

  return (
    <div className="grid grid-cols-3 gap-4">
      {TILES.map((tile, i) => {
        const Icon = tile.icon
        const value = values[tile.key]
        return (
          <motion.div
            key={tile.key}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
            className="bg-ink-2 border border-ink-3 rounded-xl px-5 py-4 hover-lift"
          >
            <div className="flex items-center gap-2 mb-2">
              <Icon className={`w-4 h-4 ${tile.accent}`} />
              <p className="text-[11px] font-inter font-medium text-ink-subtle uppercase tracking-wider">
                {tile.label}
              </p>
            </div>
            <p className="font-playfair text-3xl text-cream tabular-nums">{value}</p>
          </motion.div>
        )
      })}
    </div>
  )
}
