import type { Block } from '@/lib/blocks/schema'

const SAFE_HREF = /^(https?:|mailto:|tel:|\/|#)/i

function safeHref(href?: string): string | undefined {
  return href && SAFE_HREF.test(href) ? href : undefined
}

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
                {block.ctaText && safeHref(block.ctaHref) && (
                  <a href={safeHref(block.ctaHref)} rel="noopener noreferrer">
                    {block.ctaText}
                  </a>
                )}
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
              <a key={block.id} href={safeHref(block.href)} data-style={block.style} rel="noopener noreferrer">
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
