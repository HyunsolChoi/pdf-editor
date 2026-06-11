import { useEffect, useState } from 'react'
import type { PageDescriptor } from '../types'
import { usePageAspect } from '../hooks/usePageAspect'

interface PageThumbnailProps {
  descriptor: PageDescriptor
}

export default function PageThumbnail({ descriptor }: PageThumbnailProps) {
  const [src, setSrc] = useState<string | null>(null)
  const aspect = usePageAspect(descriptor)

  useEffect(() => {
    if (descriptor.source.kind === 'blank') return

    const { source, rotation } = descriptor
    let cancelled = false

    const render = async () => {
      const page = await source.doc.getPage(source.pageNumber)
      const viewport = page.getViewport({ scale: 0.2, rotation })
      const canvas = document.createElement('canvas')
      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      await page.render({ canvasContext: ctx, viewport, canvas }).promise
      if (cancelled) return
      setSrc(canvas.toDataURL('image/png'))
    }

    void render()
    return () => {
      cancelled = true
    }
  }, [descriptor])

  return (
    <div className="page-thumb__preview" style={{ aspectRatio: `${aspect}` }}>
      {src ? <img src={src} alt="" /> : <div className="page-thumb__blank" />}
    </div>
  )
}
