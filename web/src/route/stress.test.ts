import { describe, expect, it } from 'vitest'
import { stressLevel, stressScore } from './stress'

const at = (lts: number, distance: number, walk: 'sidewalk' | null = null) => ({ lts, distance, walk })

describe('stressScore', () => {
  it('runs from 1 on pathways to 10 on arterials', () => {
    expect(stressScore([at(1, 5000)])).toBe(1)
    expect(stressScore([at(4, 5000)])).toBe(10)
    expect(stressScore([])).toBe(1)
  })
  it('weights each level by its share of the distance', () => {
    // 19 / 2 / 12 / 67 %: 1 + 9 × (0.25×0.02 + 0.6×0.12 + 0.67) ≈ 7.7
    expect(stressScore([at(1, 1900), at(2, 200), at(3, 1200), at(4, 6700)])).toBe(8)
    expect(stressScore([at(2, 1000)])).toBe(3)
  })
  it('counts walking the bike as nearly calm', () => {
    expect(stressScore([at(0, 1000, 'sidewalk')])).toBe(2)
  })
  it('stays at 5 or more with a long enough high-stress stretch', () => {
    expect(stressScore([at(1, 9700), at(4, 300)])).toBe(5)
    // Short ones, even several, do not add up to a stretch.
    expect(stressScore([at(4, 60), at(1, 9000), at(4, 60)])).toBe(1)
    // Consecutive pieces of the same road do.
    expect(stressScore([at(1, 9000), at(4, 60), at(4, 60)])).toBe(5)
  })
})

describe('stressLevel', () => {
  it('reads the score as a level of traffic stress', () => {
    expect([1, 2, 3, 4, 5, 7, 8, 10].map(stressLevel)).toEqual([1, 1, 2, 2, 3, 3, 4, 4])
  })
})
