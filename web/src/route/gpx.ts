import type { Route } from './brouter'

const escapeXml = (text: string) => text.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`)

/** The route as a GPX track, for bike computers and phone apps. */
export function toGpx(route: Route, name: string): string {
  const points = route.coords
    .map(
      ([lon, lat, ele]) => `<trkpt lat="${lat}" lon="${lon}">${ele === undefined ? '' : `<ele>${ele}</ele>`}</trkpt>`,
    )
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Bike Ottawa Maps" xmlns="http://www.topografix.com/GPX/1/1">
<trk><name>${escapeXml(name)}</name><trkseg>
${points}
</trkseg></trk>
</gpx>
`
}

export function downloadText(filename: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
