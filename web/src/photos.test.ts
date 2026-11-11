import { describe, expect, it } from 'vitest'
import {
  commonsLink,
  directImage,
  imageLink,
  mapillaryId,
  mapillaryViewerUrl,
  nearbyImages,
  streetViewUrl,
} from './photos'

describe('mapillaryId', () => {
  it('takes the first image id from the tag', () => {
    expect(mapillaryId('262623838945219')).toBe('262623838945219')
    expect(mapillaryId('262623838945219;468355031124550')).toBe('262623838945219')
  })
  it('ignores what is not an image id', () => {
    expect(mapillaryId(undefined)).toBeNull()
    expect(mapillaryId('yes')).toBeNull()
    expect(mapillaryId('https://www.mapillary.com/app/?pKey=1')).toBeNull()
  })
  it('links to the viewer', () => {
    expect(mapillaryViewerUrl('262623838945219')).toBe(
      'https://www.mapillary.com/app/?pKey=262623838945219&focus=photo',
    )
  })
})

describe('imageLink', () => {
  it('accepts only web links', () => {
    expect(imageLink('https://example.org/bench.jpg')).toBe('https://example.org/bench.jpg')
    expect(imageLink('File:Bench.jpg')).toBeNull()
    expect(imageLink('javascript:alert(1)')).toBeNull()
  })
})

describe('directImage', () => {
  it('takes links that are pictures, not pages', () => {
    const osc = 'https://storage6.openstreetcam.org/files/photo/2017/10/4/lth/931937_73f33_38.jpg'
    expect(directImage(osc)).toBe(osc)
    expect(directImage('https://photos.app.goo.gl/abc123')).toBeNull()
  })
})

describe('commonsLink', () => {
  it('links files and categories', () => {
    expect(commonsLink('Category:Greenboro Station')).toBe(
      'https://commons.wikimedia.org/wiki/Category:Greenboro_Station',
    )
    expect(commonsLink('Bench.jpg')).toBeNull()
  })
})

describe('streetViewUrl', () => {
  it('opens Street View nearest the point', () => {
    expect(streetViewUrl([-75.69485, 45.42021])).toBe(
      'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=45.420210,-75.694850',
    )
  })
})

describe('nearbyImages', () => {
  const at: [number, number] = [-75.69485, 45.42021]
  const image = (id: string, dLat: number, sequence: string, pano = false) => ({
    id,
    computed_geometry: { coordinates: [at[0], at[1] + dLat] as [number, number] },
    is_pano: pano,
    sequence,
  })
  it('lists the closest photo of each capture run, nearest first', () => {
    const found = nearbyImages([image('a2', 0.0002, 'a'), image('a1', 0.0001, 'a'), image('b1', 0.00015, 'b')], at)
    expect(found.map((f) => f.id)).toEqual(['a1', 'b1'])
    expect(Math.round(found[0].distance)).toBe(11)
  })
  it('puts flat photos ahead of panoramas about as close', () => {
    // A panorama 5 m away comes after a flat photo 11 m away.
    expect(nearbyImages([image('pano', 0.000045, 'p', true), image('flat', 0.0001, 'f')], at)[0].id).toBe('flat')
    expect(nearbyImages([], at)).toEqual([])
  })
})
