import { describe, expect, it } from 'vitest'
import { imageLink, mapillaryId, mapillaryViewerUrl } from './photos'

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
