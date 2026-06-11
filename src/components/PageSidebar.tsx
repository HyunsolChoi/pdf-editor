import { useState } from 'react'
import type { PageDescriptor } from '../types'
import PageThumbnail from './PageThumbnail'
import { usePageAspect } from '../hooks/usePageAspect'
import { PlusIcon, RotateIcon, TrashIcon, DragHandleIcon } from './icons'

interface PageSidebarProps {
  pages: PageDescriptor[]
  activePageId: string | null
  width: number
  onActivate: (id: string) => void
  onAddBlank: () => void
  onRotate: (id: string) => void
  onDelete: (id: string) => void
  onReorder: (fromId: string, toId: string) => void
}

export default function PageSidebar({
  pages,
  activePageId,
  width,
  onActivate,
  onAddBlank,
  onRotate,
  onDelete,
  onReorder,
}: PageSidebarProps) {
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const lastPage = pages[pages.length - 1]
  const lastPageAspect = usePageAspect(lastPage)

  return (
    <aside className="page-sidebar" style={{ width }}>
      <div className="page-sidebar__list">
        {pages.map((page, idx) => (
          <div
            key={page.id}
            className={`page-thumb${activePageId === page.id ? ' page-thumb--active' : ''}${
              overId === page.id ? ' page-thumb--over' : ''
            }`}
            draggable
            onClick={() => onActivate(page.id)}
            onDragStart={() => setDragId(page.id)}
            onDragOver={(e) => {
              e.preventDefault()
              if (overId !== page.id) setOverId(page.id)
            }}
            onDragLeave={() => setOverId((current) => (current === page.id ? null : current))}
            onDrop={(e) => {
              e.preventDefault()
              setOverId(null)
              if (dragId) onReorder(dragId, page.id)
              setDragId(null)
            }}
            onDragEnd={() => {
              setDragId(null)
              setOverId(null)
            }}
          >
            <span className="page-thumb__handle">
              <DragHandleIcon width={14} height={14} />
            </span>
            <span className="page-thumb__number">{idx + 1}</span>
            <PageThumbnail descriptor={page} />
            <div className="page-thumb__overlay">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onRotate(page.id)
                }}
                title="회전"
              >
                <RotateIcon width={14} height={14} />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(page.id)
                }}
                title="삭제"
              >
                <TrashIcon width={14} height={14} />
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          className="page-thumb__add"
          style={{ aspectRatio: `${lastPageAspect}` }}
          onClick={onAddBlank}
          title="페이지 추가"
        >
          <PlusIcon width={28} height={28} />
        </button>
      </div>
    </aside>
  )
}
