import { ICON_SIZE, type PlaceKind, placeColor, placeIconPaths } from '../places'

/** Marker size in CSS pixels, and how much sharper than that it is drawn. */
const SIZE = 26
const PIXEL_RATIO = 2
/** How much of the disc the icon fills. */
const GLYPH = 15

/** A place marker for the map: the kind's icon in white on a disc of its group colour. */
export function renderPlaceImage(kind: PlaceKind): { image: ImageData; pixelRatio: number } | null {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = SIZE * PIXEL_RATIO
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.scale(PIXEL_RATIO, PIXEL_RATIO)

  const centre = SIZE / 2
  ctx.beginPath()
  ctx.arc(centre, centre, centre - 1.5, 0, Math.PI * 2)
  ctx.fillStyle = placeColor(kind)
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = '#FFFFFF'
  ctx.stroke()

  const scale = GLYPH / ICON_SIZE
  ctx.translate(centre - GLYPH / 2, centre - GLYPH / 2)
  ctx.scale(scale, scale)
  ctx.fillStyle = '#FFFFFF'
  for (const d of placeIconPaths(kind)) ctx.fill(new Path2D(d))

  return { image: ctx.getImageData(0, 0, canvas.width, canvas.height), pixelRatio: PIXEL_RATIO }
}
