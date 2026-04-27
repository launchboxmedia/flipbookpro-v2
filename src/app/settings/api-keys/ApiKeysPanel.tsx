'use client'

import { useState } from 'react'
import { Key, Copy, Check, Plus, Trash2, AlertTriangle } from 'lucide-react'

interface ExistingKey {
  id: string
  name: string
  key_prefix: string
  created_at: string
  last_used_at: string | null
}

interface Props {
  userId: string
  existingKeys: ExistingKey[]
}

export function ApiKeysPanel({ existingKeys }: Props) {
  const [keys, setKeys] = useState<ExistingKey[]>(existingKeys)
  const [newKeyName, setNewKeyName] = useState('')
  const [generatedKey, setGeneratedKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [generating, setGenerating] = useState(false)

  function generateApiKey(): string {
    // Generate a key with a recognizable prefix
    const uuid1 = crypto.randomUUID().replace(/-/g, '')
    const uuid2 = crypto.randomUUID().replace(/-/g, '')
    return `fbp_${uuid1}${uuid2.slice(0, 16)}`
  }

  async function handleGenerate() {
    if (!newKeyName.trim()) return
    setGenerating(true)

    const key = generateApiKey()
    const prefix = key.slice(0, 11) + '...'

    // In production, this would hash the key and store it via an API route.
    // For now, show the key and add to local state.
    const newEntry: ExistingKey = {
      id: crypto.randomUUID(),
      name: newKeyName.trim(),
      key_prefix: prefix,
      created_at: new Date().toISOString(),
      last_used_at: null,
    }

    setKeys(prev => [newEntry, ...prev])
    setGeneratedKey(key)
    setNewKeyName('')
    setGenerating(false)
  }

  async function handleCopy() {
    if (!generatedKey) return
    await navigator.clipboard.writeText(generatedKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleDelete(id: string) {
    // In production, this would call a DELETE API route
    setKeys(prev => prev.filter(k => k.id !== id))
  }

  function dismissGeneratedKey() {
    setGeneratedKey(null)
  }

  return (
    <div className="px-8 py-10 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h2 className="font-playfair text-3xl text-cream">API Keys</h2>
        <p className="text-muted-foreground text-sm font-source-serif mt-1">
          Manage API keys for programmatic access to your books and data.
        </p>
      </div>

      {/* Generate new key */}
      <div className="bg-[#222] border border-[#333] rounded-xl p-5 mb-6">
        <h3 className="text-sm font-inter font-medium text-cream mb-3">Create new key</h3>
        <div className="flex gap-3">
          <input
            type="text"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="Key name (e.g. Production, Staging)"
            className="flex-1 px-4 py-2.5 bg-canvas border border-[#333] rounded-lg text-cream placeholder:text-[#555] text-sm font-inter focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
            onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
          />
          <button
            onClick={handleGenerate}
            disabled={!newKeyName.trim() || generating}
            className="flex items-center gap-2 px-5 py-2.5 bg-accent hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed text-cream text-sm font-inter font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Generate
          </button>
        </div>
      </div>

      {/* Newly generated key (show once) */}
      {generatedKey && (
        <div className="bg-accent/10 border border-accent/30 rounded-xl p-5 mb-6">
          <div className="flex items-start gap-3 mb-3">
            <AlertTriangle className="w-4 h-4 text-gold mt-0.5 shrink-0" />
            <p className="text-sm font-inter text-cream">
              Copy this key now. It will not be shown again.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-4 py-2.5 bg-canvas border border-[#333] rounded-lg text-sm font-mono text-gold break-all select-all">
              {generatedKey}
            </code>
            <button
              onClick={handleCopy}
              className="shrink-0 p-2.5 bg-[#222] border border-[#333] rounded-lg text-cream hover:text-accent transition-colors"
              title="Copy to clipboard"
            >
              {copied ? <Check className="w-4 h-4 text-accent" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <button
            onClick={dismissGeneratedKey}
            className="mt-3 text-xs font-inter text-muted-foreground hover:text-cream transition-colors"
          >
            I have copied my key
          </button>
        </div>
      )}

      {/* Existing keys */}
      {keys.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Key className="w-12 h-12 text-[#333] mb-4" />
          <h3 className="font-playfair text-xl text-cream/60 mb-2">No API keys</h3>
          <p className="text-muted-foreground text-sm font-source-serif max-w-sm">
            Generate an API key above to get started with programmatic access.
          </p>
        </div>
      ) : (
        <div className="bg-[#222] border border-[#333] rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#333]">
                <th className="text-left px-5 py-3 text-xs font-inter font-medium text-muted-foreground uppercase tracking-wider">Name</th>
                <th className="text-left px-5 py-3 text-xs font-inter font-medium text-muted-foreground uppercase tracking-wider">Key</th>
                <th className="text-left px-5 py-3 text-xs font-inter font-medium text-muted-foreground uppercase tracking-wider">Created</th>
                <th className="text-left px-5 py-3 text-xs font-inter font-medium text-muted-foreground uppercase tracking-wider">Last Used</th>
                <th className="text-right px-5 py-3 text-xs font-inter font-medium text-muted-foreground uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k, i) => (
                <tr key={k.id} className={`border-b border-[#2A2A2A] ${i === keys.length - 1 ? 'border-b-0' : ''}`}>
                  <td className="px-5 py-3 text-sm font-inter text-cream">{k.name}</td>
                  <td className="px-5 py-3 text-sm font-mono text-muted-foreground">{k.key_prefix}</td>
                  <td className="px-5 py-3 text-xs font-inter text-muted-foreground">
                    {new Date(k.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3 text-xs font-inter text-muted-foreground">
                    {k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => handleDelete(k.id)}
                      className="p-1.5 text-[#555] hover:text-red-400 transition-colors rounded-md hover:bg-red-400/10"
                      title="Delete key"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Migration note */}
      <p className="mt-6 text-xs font-inter text-[#444] text-center">
        API key storage requires the api_keys table migration. Keys shown above are local to this session until the migration is applied.
      </p>
    </div>
  )
}
