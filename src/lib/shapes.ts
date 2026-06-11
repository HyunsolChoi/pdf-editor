import { Circle, Group, Line, Rect, Triangle, type FabricObject } from 'fabric'

const DEFAULT_STROKE = '#1f2430'
const DEFAULT_STROKE_WIDTH = 2

/** Minimum drag distance (canvas px) below which a click-without-drag falls back to a default size. */
const MIN_DRAG = 4

export interface Point {
  x: number
  y: number
}

function box(p1: Point, p2: Point) {
  return {
    left: Math.min(p1.x, p2.x),
    top: Math.min(p1.y, p2.y),
    width: Math.abs(p2.x - p1.x),
    height: Math.abs(p2.y - p1.y),
  }
}

export function createRectangleBetween(p1: Point, p2: Point): Rect {
  let { left, top, width, height } = box(p1, p2)
  if (width < MIN_DRAG && height < MIN_DRAG) {
    width = 160
    height = 100
    left = p2.x >= p1.x ? p1.x : p1.x - width
    top = p2.y >= p1.y ? p1.y : p1.y - height
  }
  return new Rect({
    left,
    top,
    width,
    height,
    // Fabric defaults new objects to a center origin, which would make the
    // clicked point the shape's center (growing outward in all directions
    // as the drag continues) instead of a fixed corner. Anchoring to the
    // top-left origin keeps `left`/`top` aligned with the box computed above.
    originX: 'left',
    originY: 'top',
    fill: 'transparent',
    stroke: DEFAULT_STROKE,
    strokeWidth: DEFAULT_STROKE_WIDTH,
  })
}

export function createCircleBetween(p1: Point, p2: Point): Circle {
  const { width, height } = box(p1, p2)
  let size = Math.max(width, height)
  if (size < MIN_DRAG) {
    size = 120
  }
  // Anchor the square bounding box on p1 regardless of drag direction, so the
  // clicked point always stays a fixed corner of the circle.
  const left = p2.x >= p1.x ? p1.x : p1.x - size
  const top = p2.y >= p1.y ? p1.y : p1.y - size
  return new Circle({
    left,
    top,
    radius: size / 2,
    // See createRectangleBetween: pin the origin to top-left so `left`/`top`
    // represent the anchored corner rather than the circle's center.
    originX: 'left',
    originY: 'top',
    fill: 'transparent',
    stroke: DEFAULT_STROKE,
    strokeWidth: DEFAULT_STROKE_WIDTH,
  })
}

export function createLineBetween(p1: Point, p2: Point): Line {
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  if (Math.abs(dx) < MIN_DRAG && Math.abs(dy) < MIN_DRAG) {
    return new Line([p1.x, p1.y, p1.x + 160, p1.y], {
      stroke: DEFAULT_STROKE,
      strokeWidth: DEFAULT_STROKE_WIDTH,
    })
  }
  return new Line([p1.x, p1.y, p2.x, p2.y], {
    stroke: DEFAULT_STROKE,
    strokeWidth: DEFAULT_STROKE_WIDTH,
  })
}

export function createArrowBetween(p1: Point, p2: Point): Group {
  let end = p2
  if (Math.abs(p2.x - p1.x) < MIN_DRAG && Math.abs(p2.y - p1.y) < MIN_DRAG) {
    end = { x: p1.x + 160, y: p1.y }
  }
  const angle = (Math.atan2(end.y - p1.y, end.x - p1.x) * 180) / Math.PI + 90
  const line = new Line([p1.x, p1.y, end.x, end.y], {
    stroke: DEFAULT_STROKE,
    strokeWidth: DEFAULT_STROKE_WIDTH,
  })
  const head = new Triangle({
    width: 16,
    height: 18,
    fill: DEFAULT_STROKE,
    left: end.x,
    top: end.y,
    originX: 'center',
    originY: 'center',
    angle,
  })
  return new Group([line, head], {})
}

export const SHAPE_FACTORIES = {
  rect: createRectangleBetween,
  circle: createCircleBetween,
  line: createLineBetween,
  arrow: createArrowBetween,
} satisfies Record<string, (p1: Point, p2: Point) => FabricObject>
