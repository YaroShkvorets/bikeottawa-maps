import { describe, expect, it } from 'vitest'
import { toGpx } from './gpx'

describe('toGpx', () => {
  it('writes track points with elevation and escapes the name', () => {
    const gpx = toGpx(
      {
        coords: [
          [-75.7, 45.4, 70],
          [-75.69, 45.41],
        ],
        distance: 1,
        time: 1,
        ascent: 0,
        segments: [],
      },
      'Home & <work>',
    )
    expect(gpx).toContain('<trkpt lat="45.4" lon="-75.7"><ele>70</ele></trkpt>')
    expect(gpx).toContain('<trkpt lat="45.41" lon="-75.69"></trkpt>')
    expect(gpx).toContain('<name>Home &#38; &#60;work&#62;</name>')
  })
})
