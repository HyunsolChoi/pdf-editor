import { useEffect, useState } from 'react'
import type { PageDescriptor } from '../types'

const DEFAULT_ASPECT = 595 / 842

/** Width/height ratio for a page descriptor, accounting for rotation. Falls back to A4 portrait until a PDF page's real size is known. */
export function usePageAspect(descriptor: PageDescriptor | undefined): number {
  const [pdfAspect, setPdfAspect] = useState<number | null>(null)

  useEffect(() => {
    if (!descriptor || descriptor.source.kind === 'blank') return
    const { source, rotation } = descriptor
    let cancelled = false

    void source.doc.getPage(source.pageNumber).then((page) => {
      if (cancelled) return
      const viewport = page.getViewport({ scale: 1, rotation })
      setPdfAspect(viewport.width / viewport.height)
    })

    return () => {
      cancelled = true
    }
  }, [descriptor])

  if (!descriptor) return DEFAULT_ASPECT

  if (descriptor.source.kind === 'blank') {
    const { source, rotation } = descriptor
    const swap = rotation % 180 !== 0
    const width = swap ? source.height : source.width
    const height = swap ? source.width : source.height
    return width / height
  }

  return pdfAspect ?? DEFAULT_ASPECT
}
