import type { Block } from '@/lib/blocks/schema'

export function BlockRenderer({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((block) => {
        switch (block.type) {
          case 'hero':
            return (
              <section key={block.id}>
                <h1>{block.headline}</h1>
                {block.subhead && <p>{block.subhead}</p>}
                {block.image && <img src={block.image} alt="" />}
                {block.ctaText && block.ctaHref && <a href={block.ctaHref}>{block.ctaText}</a>}
              </section>
            )
          case 'text':
            return <p key={block.id}>{block.body}</p>
          case 'imageText':
            return (
              <section
                key={block.id}
                style={{ display: 'flex', flexDirection: block.imagePosition === 'right' ? 'row-reverse' : 'row' }}
              >
                <img src={block.image} alt="" />
                <p>{block.text}</p>
              </section>
            )
          case 'button':
            return (
              <a key={block.id} href={block.href} data-style={block.style}>
                {block.text}
              </a>
            )
          case 'gallery':
            return (
              <div key={block.id}>
                {block.images.map((src, i) => (
                  <img key={i} src={src} alt="" />
                ))}
              </div>
            )
        }
      })}
    </>
  )
}
