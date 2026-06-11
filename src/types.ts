import type { Canvas } from 'fabric'
import type { PDFDocumentProxy } from './lib/pdfjs'
import type { HistoryAPI } from './lib/history'

export type Rotation = 0 | 90 | 180 | 270

export type ShapeType = 'rect' | 'circle' | 'line' | 'arrow'

export type PageSource =
  | { kind: 'pdf'; doc: PDFDocumentProxy; pageNumber: number }
  | { kind: 'blank'; width: number; height: number }

export interface PageDescriptor {
  id: string
  source: PageSource
  rotation: Rotation
}

export interface PageInfo {
  /** Page width in PDF points (unscaled), reflecting current rotation. */
  width: number
  /** Page height in PDF points (unscaled), reflecting current rotation. */
  height: number
}

export interface PageEntry {
  canvas: Canvas
  info: PageInfo
  history: HistoryAPI
}
