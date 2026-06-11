import { PDFDocument } from 'pdf-lib'

export interface PageExportData {
  /** Page width in PDF points (unscaled). */
  width: number
  /** Page height in PDF points (unscaled). */
  height: number
  /** PNG data URL containing the rendered page plus any edits. */
  dataUrl: string
}

/** Builds a new PDF from flattened page images (background + edits). */
export async function exportPdf(pages: PageExportData[]): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()

  for (const page of pages) {
    const pngBytes = await fetch(page.dataUrl).then((res) => res.arrayBuffer())
    const pngImage = await pdfDoc.embedPng(pngBytes)
    const pdfPage = pdfDoc.addPage([page.width, page.height])
    pdfPage.drawImage(pngImage, {
      x: 0,
      y: 0,
      width: page.width,
      height: page.height,
    })
  }

  return pdfDoc.save()
}

export function downloadPdf(bytes: Uint8Array, filename: string) {
  const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
