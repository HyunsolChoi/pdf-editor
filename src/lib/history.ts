import { util, type Canvas, type FabricObject } from 'fabric'

export interface HistoryAPI {
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean
  recordIfChanged: () => void
  setSuspended: (suspended: boolean) => void
  isSuspended: () => boolean
}

export function createHistory(canvas: Canvas): HistoryAPI {
  const undoStack: string[] = []
  let redoStack: string[] = []
  let restoring = false
  let suspended = false

  const snapshot = () => JSON.stringify((canvas.toObject(['selectable']) as { objects: unknown[] }).objects)

  let last = snapshot()

  const recordIfChanged = () => {
    if (restoring || suspended) return
    const current = snapshot()
    if (current === last) return
    undoStack.push(last)
    redoStack = []
    last = current
  }

  const restore = async (json: string) => {
    restoring = true
    canvas.remove(...canvas.getObjects())
    const objects = JSON.parse(json) as Record<string, unknown>[]
    const enlivened = await util.enlivenObjects(objects)
    enlivened.forEach((obj) => canvas.add(obj as FabricObject))
    canvas.discardActiveObject()
    canvas.renderAll()
    last = snapshot()
    restoring = false
  }

  const undo = () => {
    if (undoStack.length === 0) return
    const current = snapshot()
    const prev = undoStack.pop()!
    redoStack.push(current)
    void restore(prev)
  }

  const redo = () => {
    if (redoStack.length === 0) return
    const current = snapshot()
    const next = redoStack.pop()!
    undoStack.push(current)
    void restore(next)
  }

  return {
    undo,
    redo,
    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,
    recordIfChanged,
    setSuspended: (value: boolean) => {
      suspended = value
    },
    isSuspended: () => suspended,
  }
}
