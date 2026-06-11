import { useRef } from 'react'
import type { FabricObject } from 'fabric'
import type { ShapeType } from '../types'
import {
  TextIcon,
  ImageIcon,
  TrashIcon,
  RectangleIcon,
  CircleIcon,
  LineIcon,
  ArrowIcon,
  UndoIcon,
  RedoIcon,
  CopyIcon,
  MenuIcon,
  MergeIcon,
} from './icons'

interface ToolbarProps {
  disabled: boolean
  sidebarOpen: boolean
  onToggleSidebar: () => void
  onAddText: () => void
  onAddImage: (file: File) => void
  onMergePdf: (file: File) => void
  activeDrawTool: ShapeType | null
  onToggleShapeTool: (type: ShapeType) => void
  onDeleteSelected: () => void
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
  onCopy: () => void
  onPaste: () => void
  selectedObject: FabricObject | null
  onPropertyChange: (props: Record<string, unknown>) => void
}

const FONT_FAMILIES = ['Arial', '맑은 고딕', 'Georgia', 'Courier New', 'Times New Roman']

export default function Toolbar({
  disabled,
  sidebarOpen,
  onToggleSidebar,
  onAddText,
  onAddImage,
  onMergePdf,
  activeDrawTool,
  onToggleShapeTool,
  onDeleteSelected,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onCopy,
  onPaste,
  selectedObject,
  onPropertyChange,
}: ToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mergeInputRef = useRef<HTMLInputElement>(null)

  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onAddImage(file)
    e.target.value = ''
  }

  const handleMergePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onMergePdf(file)
    e.target.value = ''
  }

  return (
    <div className="toolbar">
      <div className="toolbar-scroll">
      <div className="toolbar-group">
        <button
          type="button"
          className="toolbar-btn"
          onClick={onToggleSidebar}
          title={sidebarOpen ? '사이드바 숨기기' : '사이드바 표시'}
        >
          <MenuIcon />
        </button>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <button
          type="button"
          className="toolbar-btn"
          disabled={disabled}
          onClick={() => mergeInputRef.current?.click()}
        >
          <MergeIcon />
          PDF 병합
        </button>
        <input ref={mergeInputRef} type="file" accept="application/pdf" hidden onChange={handleMergePick} />
        <button type="button" className="toolbar-btn" disabled={disabled} onClick={onAddText}>
          <TextIcon />
          텍스트 추가
        </button>
        <button
          type="button"
          className="toolbar-btn"
          disabled={disabled}
          onClick={() => fileInputRef.current?.click()}
        >
          <ImageIcon />
          이미지 추가
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml"
          hidden
          onChange={handleImagePick}
        />
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        {(
          [
            ['rect', RectangleIcon, '사각형'],
            ['circle', CircleIcon, '원'],
            ['line', LineIcon, '직선'],
            ['arrow', ArrowIcon, '화살표'],
          ] as const
        ).map(([type, Icon, label]) => (
          <button
            key={type}
            type="button"
            className={`toolbar-btn${activeDrawTool === type ? ' toolbar-btn--active' : ''}`}
            disabled={disabled}
            onClick={() => onToggleShapeTool(type)}
            title={`${label} (클릭 후 캔버스에 드래그하여 그리기)`}
          >
            <Icon />
          </button>
        ))}
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <button type="button" className="toolbar-btn" disabled={disabled || !canUndo} onClick={onUndo} title="실행 취소">
          <UndoIcon />
        </button>
        <button type="button" className="toolbar-btn" disabled={disabled || !canRedo} onClick={onRedo} title="다시 실행">
          <RedoIcon />
        </button>
        <button
          type="button"
          className="toolbar-btn"
          disabled={disabled || !selectedObject}
          onClick={() => {
            onCopy()
            onPaste()
          }}
          title="복제"
        >
          <CopyIcon />
        </button>
        <button
          type="button"
          className="toolbar-btn toolbar-btn--danger"
          disabled={disabled || !selectedObject}
          onClick={onDeleteSelected}
          title="선택 삭제"
        >
          <TrashIcon />
          선택 삭제
        </button>
      </div>

      {selectedObject && <PropertiesPanel object={selectedObject} onChange={onPropertyChange} />}
      </div>
    </div>
  )
}

interface PropertiesPanelProps {
  object: FabricObject
  onChange: (props: Record<string, unknown>) => void
}

function PropertiesPanel({ object, onChange }: PropertiesPanelProps) {
  const type = object.type

  if (type === 'textbox') {
    const textbox = object as FabricObject & {
      fill?: string
      fontFamily?: string
      fontSize?: number
      fontWeight?: string | number
    }
    const isBold = textbox.fontWeight === 'bold' || textbox.fontWeight === 700
    return (
      <div className="properties-panel">
        <label className="properties-field">
          <span>색상</span>
          <input
            type="color"
            value={String(textbox.fill ?? '#000000')}
            onChange={(e) => onChange({ fill: e.target.value })}
          />
        </label>
        <label className="properties-field">
          <span>폰트</span>
          <select
            value={textbox.fontFamily ?? 'Arial'}
            onChange={(e) => onChange({ fontFamily: e.target.value })}
          >
            {FONT_FAMILIES.map((font) => (
              <option key={font} value={font}>
                {font}
              </option>
            ))}
          </select>
        </label>
        <label className="properties-field">
          <span>크기</span>
          <input
            type="number"
            min={6}
            max={200}
            value={Math.round(textbox.fontSize ?? 24)}
            onChange={(e) => onChange({ fontSize: Number(e.target.value) })}
          />
        </label>
        <button
          type="button"
          className={`toolbar-btn properties-toggle${isBold ? ' properties-toggle--active' : ''}`}
          onClick={() => onChange({ fontWeight: isBold ? 'normal' : 'bold' })}
        >
          B
        </button>
      </div>
    )
  }

  if (type === 'rect' || type === 'circle') {
    const shape = object as FabricObject & { fill?: string; stroke?: string; strokeWidth?: number }
    const fill = shape.fill
    const isFillNone = !fill || fill === 'transparent'
    return (
      <div className="properties-panel">
        <label className="properties-field properties-field--checkbox">
          <input
            type="checkbox"
            checked={isFillNone}
            onChange={(e) => onChange({ fill: e.target.checked ? 'transparent' : '#ffffff' })}
          />
          <span>채우기 없음</span>
        </label>
        <label className="properties-field">
          <span>채우기</span>
          <input
            type="color"
            value={isFillNone ? '#ffffff' : String(fill)}
            disabled={isFillNone}
            onChange={(e) => onChange({ fill: e.target.value })}
          />
        </label>
        <label className="properties-field">
          <span>테두리</span>
          <input
            type="color"
            value={String(shape.stroke ?? '#1f2430')}
            onChange={(e) => onChange({ stroke: e.target.value })}
          />
        </label>
        <label className="properties-field">
          <span>두께</span>
          <input
            type="number"
            min={0}
            max={40}
            value={Math.round(shape.strokeWidth ?? 2)}
            onChange={(e) => onChange({ strokeWidth: Number(e.target.value) })}
          />
        </label>
      </div>
    )
  }

  if (type === 'line' || type === 'group') {
    let shape = object as FabricObject & { stroke?: string; strokeWidth?: number }
    if (type === 'group' && 'getObjects' in object) {
      const children = (object as unknown as { getObjects: () => FabricObject[] }).getObjects()
      const lineChild = children.find((child) => child.type !== 'triangle') as
        | (FabricObject & { stroke?: string; strokeWidth?: number })
        | undefined
      if (lineChild) shape = lineChild
    }
    return (
      <div className="properties-panel">
        <label className="properties-field">
          <span>색상</span>
          <input
            type="color"
            value={String(shape.stroke ?? '#1f2430')}
            onChange={(e) => onChange({ stroke: e.target.value })}
          />
        </label>
        <label className="properties-field">
          <span>두께</span>
          <input
            type="number"
            min={1}
            max={40}
            value={Math.round(shape.strokeWidth ?? 2)}
            onChange={(e) => onChange({ strokeWidth: Number(e.target.value) })}
          />
        </label>
      </div>
    )
  }

  return null
}
