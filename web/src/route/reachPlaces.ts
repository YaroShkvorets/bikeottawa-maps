import { useEffect, useState } from 'react'
import { ASSETS_BASE } from '../config'
import type { PlaceKind } from '../places'
import { countCovered, type ReachCover } from './reach'

/** Each kind's places, as the pipeline writes them: [lon, lat, lon, lat, ...]. Fetched once each. */
const points = new Map<PlaceKind, Promise<number[]>>()

function placePoints(kind: PlaceKind): Promise<number[]> {
  let pending = points.get(kind)
  if (!pending) {
    pending = fetch(`${ASSETS_BASE}/tiles/places/${kind}.json`)
      .then((res) => (res.ok ? (res.json() as Promise<number[]>) : Promise.reject(new Error(String(res.status)))))
      .catch(() => {
        // Tried again next time.
        points.delete(kind)
        return []
      })
    points.set(kind, pending)
  }
  return pending
}

export interface PlaceCount {
  kind: PlaceKind
  count: number
}

/** The places of each kind within reach; null until they are counted. */
export function useReachPlaces(cover: ReachCover | null, kinds: readonly PlaceKind[]): PlaceCount[] | null {
  const [counts, setCounts] = useState<PlaceCount[] | null>(null)
  useEffect(() => {
    setCounts(null)
    if (!cover || !kinds.length) return
    let current = true
    Promise.all(kinds.map(placePoints)).then((lists) => {
      if (current) setCounts(kinds.map((kind, i) => ({ kind, count: countCovered(lists[i], cover) })))
    })
    return () => {
      current = false
    }
  }, [cover, kinds])
  return counts
}
