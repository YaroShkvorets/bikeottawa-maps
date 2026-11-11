import { useEffect, useState } from 'react'
import { fetchRoute, type Route } from './brouter'
import type { RoutePoints } from './state'
import type { RouteParams } from './styles'

export type RouteState =
  | { status: 'idle' }
  | { status: 'loading'; previous: Route | null }
  | { status: 'ready'; route: Route }
  | { status: 'error'; message: string }

/** Small pause so dragging a marker or a slider doesn't fire a request per pixel. */
const DEBOUNCE_MS = 150

export function useRoute(
  routerUrl: string | null,
  points: RoutePoints,
  params: RouteParams,
  enabled: boolean,
): RouteState {
  const [state, setState] = useState<RouteState>({ status: 'idle' })
  const [from, to] = points
  const key = enabled && routerUrl && from && to ? JSON.stringify([from.lngLat, to.lngLat, params]) : null

  // biome-ignore lint/correctness/useExhaustiveDependencies: key captures every input that changes the route
  useEffect(() => {
    if (!key || !routerUrl || !from || !to) {
      setState({ status: 'idle' })
      return
    }
    const controller = new AbortController()
    setState((current) => ({
      status: 'loading',
      previous: current.status === 'ready' ? current.route : current.status === 'loading' ? current.previous : null,
    }))
    const timer = setTimeout(() => {
      fetchRoute(routerUrl, [from.lngLat, to.lngLat], params, controller.signal)
        .then((route) => setState({ status: 'ready', route }))
        .catch((error: unknown) => {
          if (!controller.signal.aborted)
            setState({ status: 'error', message: error instanceof Error ? error.message : String(error) })
        })
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [key, routerUrl])

  return state
}

/** The route to draw: the current one, or the last one while a new one loads. */
export function visibleRoute(state: RouteState): Route | null {
  if (state.status === 'ready') return state.route
  if (state.status === 'loading') return state.previous
  return null
}
