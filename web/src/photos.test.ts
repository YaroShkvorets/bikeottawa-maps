import { describe, expect, it } from 'vitest'
import { commonsLink, directImage, imageLink, mapillaryId, mapillaryViewerUrl, streetViewUrl } from './photos'

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
