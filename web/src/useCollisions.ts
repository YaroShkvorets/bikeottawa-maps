import { useEffect, useState } from 'react'
import type { Collision, CollisionProps } from './collisions'
import { DATA_BASE } from './config'

/**
 * The collisions, loaded the first time the collisions layer is on and kept
 * after that. Null until they arrive.
 */
export function useCollisionData(enabled: boolean): readonly Collision[] | null {
  const [data, setData] = useState<readonly Collision[] | null>(null)
  useEffect(() => {
    if (!enabled || data) return
    const controller = new AbortController()
    fetch(`${DATA_BASE}/data/collisions.geojson`, { signal: controller.signal })
      .then((res) => res.json())
      .then((json: { features: { properties: CollisionProps; geometry: { coordinates: [number, number] } }[] }) =>
        setData(json.features.map((f) => ({ props: f.properties, at: f.geometry.coordinates }))),
      )
      .catch(() => {})
    return () => controller.abort()
  }, [enabled, data])
  return data
}
