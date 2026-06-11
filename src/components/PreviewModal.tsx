import { CloseIcon, DownloadIcon } from './icons'

interface PreviewPage {
  src: string | null
  width: number
  height: number
}

interface PreviewModalProps {
  pages: PreviewPage[]
  exporting: boolean
  onClose: () => void
  onExport: () => void
}

export default function PreviewModal({ pages, exporting, onClose, onExport }: PreviewModalProps) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h2>미리보기</h2>
          <button type="button" className="toolbar-btn" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
        <div className="modal__body">
          {pages.map((page, idx) => (
            <div
              key={idx}
              className="modal__page"
              style={{ aspectRatio: `${page.width} / ${page.height}` }}
            >
              {page.src ? <img src={page.src} alt="" /> : <div className="modal__page-placeholder" />}
            </div>
          ))}
        </div>
        <div className="modal__footer">
          <button type="button" className="toolbar-btn" onClick={onClose}>
            닫기
          </button>
          <button type="button" className="toolbar-btn toolbar-btn--primary" disabled={exporting} onClick={onExport}>
            <DownloadIcon />
            {exporting ? '내보내는 중...' : 'PDF로 내보내기'}
          </button>
        </div>
      </div>
    </div>
  )
}
