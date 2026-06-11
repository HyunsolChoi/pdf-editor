import type { Canvas } from 'fabric'

/**
 * Rotates all objects on the canvas 90 degrees clockwise in place.
 * Assumes objects use center origin, matching the rest of the app.
 * Caller is responsible for resizing the canvas and updating the background.
 */
export function rotateCanvas90(canvas: Canvas) {
  const oldHeight = canvas.getHeight()

  canvas.getObjects().forEach((obj) => {
    const left = obj.left ?? 0
    const top = obj.top ?? 0
    const angle = obj.angle ?? 0
    obj.set({
      left: oldHeight - top,
      top: left,
      angle: (angle + 90) % 360,
    })
    obj.setCoords()
  })
}
