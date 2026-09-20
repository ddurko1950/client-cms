'use client'

import { useState } from 'react'
import { nanoid } from 'nanoid'
import type { Block } from '@/lib/blocks/schema'
import { HeroBlockForm } from './blocks/HeroBlockForm'
import { TextBlockForm } from './blocks/TextBlockForm'
import { ImageTextBlockForm } from './blocks/ImageTextBlockForm'
import { ButtonBlockForm } from './blocks/ButtonBlockForm'
import { GalleryBlockForm } from './blocks/GalleryBlockForm'

const BLANK_BLOCKS: Record<Block['type'], () => Block> = {
  hero: () => ({ type: 'hero', id: nanoid(), headline: '' }),
  text: () => ({ type: 'text', id: nanoid(), body: '' }),
  imageText: () => ({ type: 'imageText', id: nanoid(), image: '', text: '', imagePosition: 'left' }),
  button: () => ({ type: 'button', id: nanoid(), text: '', href: '', style: 'primary' }),
  gallery: () => ({ type: 'gallery', id: nanoid(), images: [''] }),
}

function BlockForm({ block, onChange }: { block: Block; onChange: (b: Block) => void }) {
  switch (block.type) {
    case 'hero':
      return <HeroBlockForm block={block} onChange={onChange} />
    case 'text':
      return <TextBlockForm block={block} onChange={onChange} />
    case 'imageText':
      return <ImageTextBlockForm block={block} onChange={onChange} />
    case 'button':
      return <ButtonBlockForm block={block} onChange={onChange} />
    case 'gallery':
      return <GalleryBlockForm block={block} onChange={onChange} />
  }
}

export function BlockEditor({
  pageId,
  initialBlocks,
  onSaved,
}: {
  pageId: string
  initialBlocks: Block[]
  onSaved?: () => void
}) {
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks)
  const [saving, setSaving] = useState(false)

  function addBlock(type: Block['type']) {
    setBlocks((prev) => [...prev, BLANK_BLOCKS[type]()])
  }

  function updateBlock(index: number, block: Block) {
    setBlocks((prev) => prev.map((b, i) => (i === index ? block : b)))
  }

  function removeBlock(index: number) {
    setBlocks((prev) => prev.filter((_, i) => i !== index))
  }

  function moveBlock(index: number, direction: -1 | 1) {
    setBlocks((prev) => {
      const next = [...prev]
      const target = index + direction
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  async function saveDraft() {
    setSaving(true)
    try {
      await fetch(`/api/pages/${pageId}/draft`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: { blocks, seo: {} } }),
      })
      onSaved?.()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(BLANK_BLOCKS) as Block['type'][]).map((type) => (
          <button key={type} type="button" onClick={() => addBlock(type)} className="border px-2 py-1 text-sm">
            Add {type} block
          </button>
        ))}
      </div>

      {blocks.map((block, index) => (
        <div key={block.id} className="flex flex-col gap-2 border p-4">
          <BlockForm block={block} onChange={(b) => updateBlock(index, b)} />
          <div className="flex gap-2 text-sm">
            <button type="button" onClick={() => moveBlock(index, -1)}>
              Move up
            </button>
            <button type="button" onClick={() => moveBlock(index, 1)}>
              Move down
            </button>
            <button type="button" onClick={() => removeBlock(index)}>
              Remove block
            </button>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={saveDraft}
        disabled={saving}
        className="self-start bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save draft'}
      </button>
    </div>
  )
}
