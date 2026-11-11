/** Marker size in CSS pixels, and how much sharper than that it is drawn. */
const SIZE = 20
const PIXEL_RATIO = 2

export const STOP_RED = '#C8281B'
export const LIGHT_BODY = '#1E2A30'
export const LIGHT_COLORS = ['#E5483B', '#F2B632', '#3DB55C']

/** A small stop sign or traffic light for the map. The legend draws the same shapes in SVG. */
export function renderStopImage(kind: 'stop' | 'light'): { image: ImageData; pixelRatio: number } | null {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = SIZE * PIXEL_RATIO
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.scale(PIXEL_RATIO, PIXEL_RATIO)
  const centre = SIZE / 2
  ctx.lineWidth = 1.5
  ctx.strokeStyle = '#FFFFFF'

  if (kind === 'stop') {
    // An octagon with a white rim.
    ctx.beginPath()
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI / 4) * (i + 0.5)
      ctx.lineTo(centre + Math.cos(angle) * 8.5, centre + Math.sin(angle) * 8.5)
    }
    ctx.closePath()
    ctx.fillStyle = STOP_RED
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(centre - 4.5, centre - 1.25, 9, 2.5)
  } else {
    // A dark housing with red, amber and green lamps.
    ctx.beginPath()
    ctx.roundRect(centre - 4.5, 1, 9, 18, 3)
    ctx.fillStyle = LIGHT_BODY
    ctx.fill()
    ctx.stroke()
    LIGHT_COLORS.forEach((color, i) => {
      ctx.beginPath()
      ctx.arc(centre, 4.8 + i * 5.2, 2, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.fill()
    })
  }
  return { image: ctx.getImageData(0, 0, canvas.width, canvas.height), pixelRatio: PIXEL_RATIO }
}
