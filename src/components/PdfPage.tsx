import { useEffect, useRef, useState } from 'react'
import { Canvas, FabricImage, type FabricObject, type TPointerEvent, type TPointerEventInfo } from 'fabric'
import type { PageDescriptor, PageInfo, ShapeType } from '../types'
import { rotateCanvas90 } from '../lib/rotate'
import { SHAPE_FACTORIES, type Point } from '../lib/shapes'

interface PdfPageProps {
  descriptor: PageDescriptor
  pageNumber: number
  /** Pixel scale used to render the page for editing/export quality. */
  renderScale?: number
  isActive?: boolean
  onReady: (id: string, canvas: Canvas, info: PageInfo) => void
  onActivate: (id: string) => void
  onSelectionChange: (id: string, canvas: Canvas, object: FabricObject | null) => void
  containerRef?: (id: string, el: HTMLDivElement | null) => void
  /** Available width (px) for the page list; the page is scaled down to fit within it. */
  maxWidth?: number | null
  /** Available height (px) for the page list; used for zoom-to-fit when the sidebar is closed. */
  maxHeight?: number | null
  /** Whether the page sidebar is currently open; affects how the page is fit to the available space. */
  sidebarOpen?: boolean
  drawTool?: ShapeType | null
  onDrawStart?: (id: string) => void
  onDrawEnd?: (id: string) => void
}

export default function PdfPage({
  descriptor,
  pageNumber,
  renderScale = 1.5,
  isActive = false,
  onReady,
  onActivate,
  onSelectionChange,
  containerRef,
  maxWidth = null,
  maxHeight = null,
  sidebarOpen = true,
  drawTool = null,
  onDrawStart,
  onDrawEnd,
}: PdfPageProps) {
  const canvasElRef = useRef<HTMLCanvasElement>(null)
  const fabricCanvasRef = useRef<Canvas | null>(null)
  const prevRotationRef = useRef(descriptor.rotation)
  // Page size at rotation 0, derived once at setup so rotation changes can
  // recompute dimensions deterministically without depending on the canvas's
  // current (possibly stale, if rotations are applied in quick succession) size.
  const baseSizeRef = useRef<{ cssW: number; cssH: number; ptW: number; ptH: number } | null>(null)
  // Natural (unscaled) on-screen size of the canvas, used to scale the page down to fit `maxWidth`.
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null)
  const onReadyRef = useRef(onReady)
  useEffect(() => {
    onReadyRef.current = onReady
  })

  // Initial canvas setup. Intentionally excludes `descriptor.rotation` from the
  // dependency list: rotation changes are handled by the effect below without
  // recreating the canvas.
  useEffect(() => {
    let cancelled = false
    let canvas: Canvas | null = null

    const setup = async () => {
      const { source } = descriptor
      const dpr = window.devicePixelRatio || 1
      let cssWidth: number
      let cssHeight: number
      let bgImage: FabricImage | null = null
      let info: PageInfo

      if (source.kind === 'pdf') {
        const page = await source.doc.getPage(source.pageNumber)
        const viewport = page.getViewport({ scale: renderScale, rotation: descriptor.rotation })
        const renderViewport = page.getViewport({ scale: renderScale * dpr, rotation: descriptor.rotation })

        const renderCanvas = document.createElement('canvas')
        renderCanvas.width = Math.ceil(renderViewport.width)
        renderCanvas.height = Math.ceil(renderViewport.height)
        const ctx = renderCanvas.getContext('2d')
        if (!ctx) return
        await page.render({ canvasContext: ctx, viewport: renderViewport, canvas: renderCanvas }).promise
        if (cancelled) return

        cssWidth = Math.ceil(viewport.width)
        cssHeight = Math.ceil(viewport.height)
        bgImage = await FabricImage.fromURL(renderCanvas.toDataURL('image/png'))
        bgImage.set({
          originX: 'left',
          originY: 'top',
          left: 0,
          top: 0,
          scaleX: 1 / dpr,
          scaleY: 1 / dpr,
        })

        const unscaled = page.getViewport({ scale: 1, rotation: descriptor.rotation })
        info = { width: unscaled.width, height: unscaled.height }
      } else {
        const swap = descriptor.rotation % 180 !== 0
        cssWidth = Math.round(swap ? source.height : source.width)
        cssHeight = Math.round(swap ? source.width : source.height)
        info = { width: cssWidth, height: cssHeight }
      }

      if (cancelled || !canvasElRef.current) return

      canvas = new Canvas(canvasElRef.current, {
        width: cssWidth,
        height: cssHeight,
      })
      fabricCanvasRef.current = canvas

      if (bgImage) {
        canvas.backgroundImage = bgImage
      } else {
        canvas.backgroundColor = '#ffffff'
      }
      canvas.renderAll()

      const updateSelection = () => {
        onSelectionChange(descriptor.id, canvas!, canvas!.getActiveObject() ?? null)
      }
      canvas.on('selection:created', updateSelection)
      canvas.on('selection:updated', updateSelection)
      canvas.on('selection:cleared', updateSelection)

      const swap = descriptor.rotation % 180 !== 0
      baseSizeRef.current = {
        cssW: swap ? cssHeight : cssWidth,
        cssH: swap ? cssWidth : cssHeight,
        ptW: swap ? info.height : info.width,
        ptH: swap ? info.width : info.height,
      }

      prevRotationRef.current = descriptor.rotation
      setNaturalSize({ width: cssWidth, height: cssHeight })
      onReadyRef.current(descriptor.id, canvas, info)
    }

    void setup()

    return () => {
      cancelled = true
      fabricCanvasRef.current?.dispose()
      fabricCanvasRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [descriptor.id, descriptor.source, renderScale])

  // Handle rotation changes without recreating the canvas.
  useEffect(() => {
    const canvas = fabricCanvasRef.current
    const baseSize = baseSizeRef.current
    if (!canvas || !baseSize) return
    const prev = prevRotationRef.current
    if (prev === descriptor.rotation) return
    const steps = ((descriptor.rotation - prev + 360) % 360) / 90
    prevRotationRef.current = descriptor.rotation

    // Resize the canvas and reposition existing objects synchronously, so that
    // rapid successive rotations can't read stale (not-yet-resized) canvas
    // dimensions from one another. The new size is derived from the page's
    // rotation-0 size, not from the canvas's current size.
    for (let i = 0; i < steps; i++) {
      rotateCanvas90(canvas)
    }

    const swap = descriptor.rotation % 180 !== 0
    const newW = swap ? baseSize.cssH : baseSize.cssW
    const newH = swap ? baseSize.cssW : baseSize.cssH
    const info: PageInfo = {
      width: swap ? baseSize.ptH : baseSize.ptW,
      height: swap ? baseSize.ptW : baseSize.ptH,
    }

    canvas.setDimensions({ width: newW, height: newH })
    canvas.getObjects().forEach((obj) => obj.setCoords())
    canvas.renderAll()
    setNaturalSize({ width: newW, height: newH })
    onReadyRef.current(descriptor.id, canvas, info)

    // Re-render the background at the new rotation asynchronously.
    const { source } = descriptor
    if (source.kind === 'pdf') {
      const apply = async () => {
        const dpr = window.devicePixelRatio || 1
        const page = await source.doc.getPage(source.pageNumber)
        const renderViewport = page.getViewport({ scale: renderScale * dpr, rotation: descriptor.rotation })

        const renderCanvas = document.createElement('canvas')
        renderCanvas.width = Math.ceil(renderViewport.width)
        renderCanvas.height = Math.ceil(renderViewport.height)
        const ctx = renderCanvas.getContext('2d')
        if (!ctx) return
        await page.render({ canvasContext: ctx, viewport: renderViewport, canvas: renderCanvas }).promise
        const bgImage = await FabricImage.fromURL(renderCanvas.toDataURL('image/png'))
        bgImage.set({
          originX: 'left',
          originY: 'top',
          left: 0,
          top: 0,
          scaleX: 1 / dpr,
          scaleY: 1 / dpr,
        })
        if (fabricCanvasRef.current !== canvas || prevRotationRef.current !== descriptor.rotation) return
        canvas.backgroundImage = bgImage
        canvas.renderAll()
      }

      void apply()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [descriptor.rotation])

  // Drag-to-draw: when a shape tool is armed, dragging on this page's canvas
  // creates the shape between the drag start/end points instead of selecting objects.
  useEffect(() => {
    const canvas = fabricCanvasRef.current
    if (!canvas || !drawTool) return

    const previousSelection = canvas.selection
    const previousDefaultCursor = canvas.defaultCursor
    const previousHoverCursor = canvas.hoverCursor
    canvas.discardActiveObject()
    canvas.selection = false
    canvas.defaultCursor = 'crosshair'
    canvas.hoverCursor = 'crosshair'
    canvas.renderAll()

    let startPoint: Point | null = null
    let previewObject: FabricObject | null = null

    const finishDraw = () => {
      startPoint = null
      previewObject = null
      onDrawEnd?.(descriptor.id)
    }

    const handleMouseDown = (opt: TPointerEventInfo<TPointerEvent>) => {
      const point = canvas.getScenePoint(opt.e)
      startPoint = { x: point.x, y: point.y }
      onDrawStart?.(descriptor.id)
    }

    const handleMouseMove = (opt: TPointerEventInfo<TPointerEvent>) => {
      if (!startPoint) return
      const point = canvas.getScenePoint(opt.e)
      if (previewObject) canvas.remove(previewObject)
      previewObject = SHAPE_FACTORIES[drawTool](startPoint, { x: point.x, y: point.y })
      previewObject.set({ selectable: false, evented: false })
      canvas.add(previewObject)
      canvas.renderAll()
    }

    const handleMouseUp = (opt: TPointerEventInfo<TPointerEvent>) => {
      if (!startPoint) return
      const point = canvas.getScenePoint(opt.e)
      if (previewObject) canvas.remove(previewObject)
      const finalObject = SHAPE_FACTORIES[drawTool](startPoint, { x: point.x, y: point.y })
      canvas.add(finalObject)
      finalObject.setCoords()
      canvas.setActiveObject(finalObject)
      canvas.renderAll()

      finishDraw()
      canvas.fire('object:modified', { target: finalObject })
    }

    canvas.on('mouse:down', handleMouseDown)
    canvas.on('mouse:move', handleMouseMove)
    canvas.on('mouse:up', handleMouseUp)

    return () => {
      canvas.off('mouse:down', handleMouseDown)
      canvas.off('mouse:move', handleMouseMove)
      canvas.off('mouse:up', handleMouseUp)
      canvas.selection = previousSelection
      canvas.defaultCursor = previousDefaultCursor
      canvas.hoverCursor = previousHoverCursor
      if (previewObject) canvas.remove(previewObject)
      if (startPoint) finishDraw()
      canvas.renderAll()
    }
  }, [drawTool, descriptor.id, onDrawStart, onDrawEnd])

  let scale = 1
  if (naturalSize) {
    if (sidebarOpen) {
      const fitWidth = maxWidth ? maxWidth * 0.78 : null
      if (fitWidth && naturalSize.width > fitWidth) scale = fitWidth / naturalSize.width
    } else {
      const widthScale = maxWidth ? maxWidth / naturalSize.width : null
      const heightScale = maxHeight ? maxHeight / naturalSize.height : null
      const candidates = [widthScale, heightScale].filter((s): s is number => s !== null)
      if (candidates.length) scale = Math.min(...candidates) * 0.7
    }
  }

  return (
    <div
      className="pdf-page-frame"
      style={naturalSize ? { width: naturalSize.width * scale, height: naturalSize.height * scale } : undefined}
    >
      <div
        className={`pdf-page${isActive ? ' pdf-page--active' : ''}`}
        style={naturalSize ? { width: naturalSize.width, height: naturalSize.height, transform: `scale(${scale})` } : undefined}
        onMouseDown={() => onActivate(descriptor.id)}
        ref={(el) => containerRef?.(descriptor.id, el)}
      >
        <span className="pdf-page__badge">{pageNumber}</span>
        <canvas ref={canvasElRef} />
      </div>
    </div>
  )
}
