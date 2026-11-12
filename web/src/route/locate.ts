import type { LngLat } from './brouter'

/** Where the device is; rejects when the location is refused, unknown or slow to come. */
export function locate(): Promise<LngLat> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('No geolocation'))
    navigator.geolocation.getCurrentPosition(({ coords }) => resolve([coords.longitude, coords.latitude]), reject, {
      enableHighAccuracy: true,
      timeout: 15_000,
      maximumAge: 60_000,
    })
  })
}
