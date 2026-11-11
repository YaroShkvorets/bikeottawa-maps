import type { RouteSegment } from './brouter'

/** How much each kind of stretch adds to the stress score, from none (1) to all of it (10). */
const WEIGHTS = { lts1: 0, lts2: 0.25, lts3: 0.6, lts4: 1, walk: 0.1 } as const

/** Any high-stress stretch this long, in metres, keeps the score at or above FLOOR. */
const FLOOR_STRETCH_M = 100
const FLOOR = 5

function weightOf(segment: Pick<RouteSegment, 'lts' | 'walk'>): number {
  if (segment.walk || segment.lts < 1) return WEIGHTS.walk
  return [WEIGHTS.lts1, WEIGHTS.lts2, WEIGHTS.lts3, WEIGHTS.lts4][Math.min(segment.lts, 4) - 1]
}

/**
 * How stressful a route is to ride, 1 (very calm) to 10 (extremely stressful):
 * the share of the distance at each level of traffic stress, weighted. An
 * average hides a short bad stretch, so a continuous high-stress stretch of
 * 100 m or more puts the score at 5 at least.
 */
export function stressScore(segments: readonly Pick<RouteSegment, 'lts' | 'walk' | 'distance'>[]): number {
  let total = 0
  let weighted = 0
  let highStretch = 0
  let longestHigh = 0
  for (const segment of segments) {
    total += segment.distance
    weighted += segment.distance * weightOf(segment)
    highStretch = segment.lts === 4 && !segment.walk ? highStretch + segment.distance : 0
    longestHigh = Math.max(longestHigh, highStretch)
  }
  if (total <= 0) return 1
  const score = Math.round(1 + 9 * (weighted / total))
  return longestHigh >= FLOOR_STRETCH_M ? Math.max(score, FLOOR) : score
}

/** Which level of traffic stress a score reads as, for its colour: 1-2, 3-4, 5-7, 8-10. */
export function stressLevel(score: number): 1 | 2 | 3 | 4 {
  if (score <= 2) return 1
  if (score <= 4) return 2
  if (score <= 7) return 3
  return 4
}
