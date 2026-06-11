import { useCallback, useEffect, useRef, useState } from 'react'
import { Canvas, FabricImage, Textbox, type FabricObject } from 'fabric'
import { pdfjsLib } from './lib/pdfjs'
import { exportPdf, downloadPdf } from './lib/exportPdf'
import { createHistory } from './lib/history'
import type { PageDescriptor, PageEntry, PageInfo, Rotation, ShapeType } from './types'
import PdfPage from './components/PdfPage'
import Toolbar from './components/Toolbar'
import PageSidebar from './components/PageSidebar'
import PreviewModal from './components/PreviewModal'
import { DocumentIcon, DownloadIcon, EyeIcon, UploadIcon } from './components/icons'
import './App.css'

interface Selection {
  pageId: string
  canvas: Canvas
  object: FabricObject
}

interface PreviewPage {
  src: string | null
  width: number
  height: number
}

function App() {
  const [pages, setPages] = useState<PageDescriptor[]>([])
  const [fileName, setFileName] = useState('')
  const [activePageId, setActivePageId] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [isDraggingFile, setIsDraggingFile] = useState(false)
  const [selection, setSelection] = useState<Selection | null>(null)
  const [historyFlags, setHistoryFlags] = useState({ canUndo: false, canRedo: false })
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewPages, setPreviewPages] = useState<PreviewPage[] | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [sidebarWidth, setSidebarWidth] = useState(200)
  const [drawTool, setDrawTool] = useState<ShapeType | null>(null)
  const [pageListWidth, setPageListWidth] = useState<number | null>(null)
  const [pageListHeight, setPageListHeight] = useState<number | null>(null)
  const dragCounterRef = useRef(0)

  const pagesRef = useRef<Map<string, PageEntry>>(new Map())
  const pageElsRef = useRef<Map<string, HTMLDivElement>>(new Map())
  const pageListRef = useRef<HTMLElement | null>(null)
  const clipboardRef = useRef<FabricObject | null>(null)
  const activePageIdRef = useRef<string | null>(null)

  useEffect(() => {
    activePageIdRef.current = activePageId
  }, [activePageId])

  // Track the page list's available content width so pages can be scaled down
  // to fit (e.g. when the sidebar is opened/resized) instead of overflowing.
  useEffect(() => {
    const el = pageListRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        setPageListWidth(entry.contentRect.width)
        setPageListHeight(entry.contentRect.height)
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const refreshHistoryFlags = useCallback((id: string | null) => {
    const entry = id ? pagesRef.current.get(id) : null
    setHistoryFlags({ canUndo: entry?.history.canUndo() ?? false, canRedo: entry?.history.canRedo() ?? false })
  }, [])

  useEffect(() => {
    refreshHistoryFlags(activePageId)
  }, [activePageId, refreshHistoryFlags])

  const loadPdfFile = useCallback(async (file: File) => {
    if (!file.type.includes('pdf') && !/\.pdf$/i.test(file.name)) return

    const buffer = await file.arrayBuffer()
    const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise

    pagesRef.current.forEach(({ canvas }) => canvas.dispose())
    pagesRef.current.clear()
    pageElsRef.current.clear()

    const newPages: PageDescriptor[] = Array.from({ length: doc.numPages }, (_, i) => ({
      id: crypto.randomUUID(),
      source: { kind: 'pdf', doc, pageNumber: i + 1 },
      rotation: 0,
    }))

    setFileName(file.name.replace(/\.pdf$/i, ''))
    setPages(newPages)
    setActivePageId(null)
    setSelection(null)
  }, [])

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    await loadPdfFile(file)
    e.target.value = ''
  }, [loadPdfFile])

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (!e.dataTransfer.types.includes('Files')) return
    dragCounterRef.current += 1
    setIsDraggingFile(true)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1)
    if (dragCounterRef.current === 0) setIsDraggingFile(false)
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    dragCounterRef.current = 0
    setIsDraggingFile(false)
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    await loadPdfFile(file)
  }, [loadPdfFile])

  const handlePageReady = useCallback((id: string, canvas: Canvas, info: PageInfo) => {
    const existing = pagesRef.current.get(id)
    if (existing) {
      existing.canvas = canvas
      existing.info = info
    } else {
      const history = createHistory(canvas)
      const recordAndTick = () => {
        if (history.isSuspended()) return
        history.recordIfChanged()
        if (activePageIdRef.current === id) refreshHistoryFlags(id)
      }
      canvas.on('object:added', recordAndTick)
      canvas.on('object:removed', recordAndTick)
      canvas.on('object:modified', recordAndTick)
      pagesRef.current.set(id, { canvas, info, history })
    }
    setActivePageId((current) => current ?? id)
  }, [refreshHistoryFlags])

  const handleActivate = useCallback((id: string) => {
    setActivePageId(id)
  }, [])

  const handleSidebarActivate = useCallback((id: string) => {
    setActivePageId(id)
    pageElsRef.current.get(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [])

  const handleSelectionChange = useCallback((id: string, canvas: Canvas, object: FabricObject | null) => {
    setSelection(object ? { pageId: id, canvas, object } : null)
  }, [])

  const handleContainerRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) pageElsRef.current.set(id, el)
    else pageElsRef.current.delete(id)
  }, [])

  const getActiveEntry = (): PageEntry | null => {
    if (activePageId === null) return null
    return pagesRef.current.get(activePageId) ?? null
  }

  const getActiveCanvas = (): Canvas | null => getActiveEntry()?.canvas ?? null

  const handleAddText = () => {
    const canvas = getActiveCanvas()
    if (!canvas) return
    const text = new Textbox('텍스트를 입력하세요', {
      width: 200,
      fontSize: 24,
      fill: '#000000',
      originX: 'center',
      originY: 'center',
    })
    text.set({
      left: canvas.getWidth() / 2,
      top: canvas.getHeight() / 2,
    })
    canvas.add(text)
    canvas.setActiveObject(text)
    canvas.renderAll()
  }

  const handleAddImage = async (file: File) => {
    const canvas = getActiveCanvas()
    if (!canvas) return

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

    const image = await FabricImage.fromURL(dataUrl)
    const maxWidth = canvas.getWidth() * 0.5
    if (image.width && image.width > maxWidth) {
      image.scaleToWidth(maxWidth)
    }
    image.set({
      originX: 'center',
      originY: 'center',
      left: canvas.getWidth() / 2,
      top: canvas.getHeight() / 2,
    })
    canvas.add(image)
    canvas.setActiveObject(image)
    canvas.renderAll()
  }

  const handleToggleShapeTool = (type: ShapeType) => {
    setDrawTool((current) => (current === type ? null : type))
  }

  const handleDrawStart = useCallback((id: string) => {
    pagesRef.current.get(id)?.history.setSuspended(true)
  }, [])

  const handleDrawEnd = useCallback((id: string) => {
    pagesRef.current.get(id)?.history.setSuspended(false)
    setDrawTool(null)
  }, [])

  const handleDeleteSelected = () => {
    const canvas = getActiveCanvas()
    if (!canvas) return
    for (const obj of canvas.getActiveObjects()) {
      canvas.remove(obj)
    }
    canvas.discardActiveObject()
    canvas.renderAll()
    setSelection(null)
  }

  const handleUndo = useCallback(() => {
    const entry = getActiveEntry()
    if (!entry) return
    entry.history.undo()
    setSelection(null)
    refreshHistoryFlags(activePageId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePageId, refreshHistoryFlags])

  const handleRedo = useCallback(() => {
    const entry = getActiveEntry()
    if (!entry) return
    entry.history.redo()
    setSelection(null)
    refreshHistoryFlags(activePageId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePageId, refreshHistoryFlags])

  const handleCopy = useCallback(async () => {
    const canvas = getActiveCanvas()
    const obj = canvas?.getActiveObject()
    if (!canvas || !obj) return
    clipboardRef.current = await obj.clone()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePageId])

  const handlePaste = useCallback(async () => {
    const canvas = getActiveCanvas()
    if (!canvas || !clipboardRef.current) return
    const cloned = await clipboardRef.current.clone()
    cloned.set({
      left: (cloned.left ?? 0) + 20,
      top: (cloned.top ?? 0) + 20,
    })
    canvas.add(cloned)
    canvas.setActiveObject(cloned)
    canvas.renderAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePageId])

  const handlePropertyChange = useCallback((props: Record<string, unknown>) => {
    if (!selection) return
    const { object, canvas } = selection
    if (object.type === 'group' && 'getObjects' in object) {
      const children = (object as unknown as { getObjects: () => FabricObject[] }).getObjects()
      children.forEach((child) => {
        if (child.type === 'triangle') {
          if ('stroke' in props) child.set('fill', props.stroke)
        } else {
          if ('stroke' in props) child.set('stroke', props.stroke)
          if ('strokeWidth' in props) child.set('strokeWidth', props.strokeWidth)
        }
      })
    } else {
      object.set(props)
    }
    canvas.renderAll()
    canvas.fire('object:modified', { target: object })
    setSelection({ ...selection })
  }, [selection])

  const handleAddBlankPage = () => {
    const newPage: PageDescriptor = {
      id: crypto.randomUUID(),
      source: { kind: 'blank', width: 595, height: 842 },
      rotation: 0,
    }
    setPages((prev) => {
      const idx = activePageId ? prev.findIndex((p) => p.id === activePageId) : prev.length - 1
      const insertAt = idx === -1 ? prev.length : idx + 1
      const next = [...prev]
      next.splice(insertAt, 0, newPage)
      return next
    })
    setActivePageId(newPage.id)
  }

  const handleDeletePage = (id: string) => {
    const entry = pagesRef.current.get(id)
    entry?.canvas.dispose()
    pagesRef.current.delete(id)
    pageElsRef.current.delete(id)

    setPages((prev) => {
      const idx = prev.findIndex((p) => p.id === id)
      const next = prev.filter((p) => p.id !== id)
      if (activePageIdRef.current === id) {
        const fallback = next[Math.min(idx, next.length - 1)] ?? null
        setActivePageId(fallback ? fallback.id : null)
      }
      return next
    })
    setSelection((current) => (current?.pageId === id ? null : current))
  }

  const handleRotatePage = (id: string) => {
    setPages((prev) =>
      prev.map((p) => (p.id === id ? { ...p, rotation: (((p.rotation + 90) % 360) as Rotation) } : p)),
    )
  }

  const handleMergePdf = async (file: File) => {
    const buffer = await file.arrayBuffer()
    const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise
    const newPages: PageDescriptor[] = Array.from({ length: doc.numPages }, (_, i) => ({
      id: crypto.randomUUID(),
      source: { kind: 'pdf', doc, pageNumber: i + 1 },
      rotation: 0,
    }))
    setPages((prev) => [...prev, ...newPages])
  }

  const handleReorderPages = (fromId: string, toId: string) => {
    if (fromId === toId) return
    setPages((prev) => {
      const fromIdx = prev.findIndex((p) => p.id === fromId)
      const toIdx = prev.findIndex((p) => p.id === toId)
      if (fromIdx === -1 || toIdx === -1) return prev
      const next = [...prev]
      const [moved] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, moved)
      return next
    })
  }

  const handleExport = async () => {
    if (pages.length === 0) return
    setExporting(true)
    try {
      const exportPages = []
      for (const desc of pages) {
        const entry = pagesRef.current.get(desc.id)
        if (!entry) continue
        exportPages.push({
          width: entry.info.width,
          height: entry.info.height,
          dataUrl: entry.canvas.toDataURL({ format: 'png', multiplier: 1 }),
        })
      }
      const bytes = await exportPdf(exportPages)
      downloadPdf(bytes, `${fileName || 'edited'}.pdf`)
    } finally {
      setExporting(false)
    }
  }

  // Global keyboard shortcuts: undo/redo, copy/paste, delete.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return

      const canvas = getActiveCanvas()
      const activeObject = canvas?.getActiveObject()
      if (activeObject && (activeObject as unknown as { isEditing?: boolean }).isEditing) return

      const meta = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()

      if (meta && key === 'z' && !e.shiftKey) {
        e.preventDefault()
        handleUndo()
      } else if (meta && ((key === 'z' && e.shiftKey) || key === 'y')) {
        e.preventDefault()
        handleRedo()
      } else if (meta && key === 'c') {
        e.preventDefault()
        void handleCopy()
      } else if (meta && key === 'v') {
        e.preventDefault()
        void handlePaste()
      } else if (key === 'delete' || key === 'backspace') {
        if (activeObject) {
          e.preventDefault()
          handleDeleteSelected()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePageId, handleUndo, handleRedo, handleCopy, handlePaste])

  const handleOpenPreview = () => {
    setPreviewPages(
      pages.map((p) => {
        const entry = pagesRef.current.get(p.id)
        return {
          src: entry?.canvas.toDataURL({ format: 'png', multiplier: 1 }) ?? null,
          width: entry?.info.width ?? 595,
          height: entry?.info.height ?? 842,
        }
      }),
    )
    setPreviewOpen(true)
  }

  const handleClosePreview = () => {
    setPreviewOpen(false)
    setPreviewPages(null)
  }

  const handleSidebarResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = sidebarWidth

    const handleMove = (ev: MouseEvent) => {
      const next = Math.min(Math.max(startWidth + (ev.clientX - startX), 140), 480)
      setSidebarWidth(next)
    }
    const handleUp = () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
  }, [sidebarWidth])

  const hasPages = pages.length > 0

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-brand">
          <div className="app-brand__text">
            <h1>
              PDF 편집기 <span className="app-brand__by">by 현솔</span>
            </h1>
          </div>
        </div>

        <div className="app-header-spacer" />

        {fileName && (
          <div className="file-name-chip">
            <DocumentIcon width={16} height={16} />
            <span>{fileName}.pdf</span>
          </div>
        )}

        <button type="button" className="header-btn" disabled={!hasPages} onClick={handleOpenPreview}>
          <EyeIcon width={16} height={16} />
          미리보기
        </button>

        <button
          type="button"
          className="header-btn header-btn--primary"
          disabled={!hasPages || exporting}
          onClick={handleExport}
        >
          <DownloadIcon width={16} height={16} />
          {exporting ? '내보내는 중...' : 'PDF로 내보내기'}
        </button>

        <label className="file-input-label">
          <UploadIcon width={16} height={16} />
          PDF 열기
          <input type="file" accept="application/pdf" onChange={handleFileChange} />
        </label>
      </header>

      <Toolbar
        disabled={!hasPages || activePageId === null}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((open) => !open)}
        onAddText={handleAddText}
        onAddImage={handleAddImage}
        onMergePdf={(file) => void handleMergePdf(file)}
        activeDrawTool={drawTool}
        onToggleShapeTool={handleToggleShapeTool}
        onDeleteSelected={handleDeleteSelected}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={historyFlags.canUndo}
        canRedo={historyFlags.canRedo}
        onCopy={() => void handleCopy()}
        onPaste={() => void handlePaste()}
        selectedObject={selection?.object ?? null}
        onPropertyChange={handlePropertyChange}
      />

      <div className="workspace">
        {hasPages && sidebarOpen && (
          <>
            <PageSidebar
              pages={pages}
              activePageId={activePageId}
              width={sidebarWidth}
              onActivate={handleSidebarActivate}
              onAddBlank={handleAddBlankPage}
              onRotate={handleRotatePage}
              onDelete={handleDeletePage}
              onReorder={handleReorderPages}
            />
            <div className="sidebar-resizer" onMouseDown={handleSidebarResizeStart} />
          </>
        )}

        <main
          ref={pageListRef}
          className={`page-list${isDraggingFile ? ' page-list--dragging' : ''}`}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {isDraggingFile && (
            <div className="drop-overlay">
              <span className="placeholder-icon">
                <UploadIcon width={28} height={28} />
              </span>
              <strong>여기에 PDF 파일을 놓으세요</strong>
            </div>
          )}
          {!hasPages && (
            <div className="placeholder">
              <span className="placeholder-icon">
                <DocumentIcon width={28} height={28} />
              </span>
              <strong>PDF 파일을 업로드하세요</strong>
              <span>오른쪽 위의 'PDF 열기' 버튼을 누르거나 파일을 이곳에 끌어다 놓으세요.</span>
            </div>
          )}
          {pages.map((descriptor, idx) => (
            <PdfPage
              key={descriptor.id}
              descriptor={descriptor}
              pageNumber={idx + 1}
              isActive={activePageId === descriptor.id}
              onReady={handlePageReady}
              onActivate={handleActivate}
              onSelectionChange={handleSelectionChange}
              containerRef={handleContainerRef}
              maxWidth={pageListWidth}
              maxHeight={pageListHeight}
              sidebarOpen={sidebarOpen}
              drawTool={drawTool}
              onDrawStart={handleDrawStart}
              onDrawEnd={handleDrawEnd}
            />
          ))}
        </main>
      </div>

      {previewOpen && (
        <PreviewModal
          pages={previewPages ?? []}
          exporting={exporting}
          onClose={handleClosePreview}
          onExport={handleExport}
        />
      )}
    </div>
  )
}

export default App
