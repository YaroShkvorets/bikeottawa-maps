import { useEffect, useState } from 'react'
import type { LngLat } from './brouter'
import { fetchReach, type Reach } from './reach'
import type { Profile } from './styles'

export type ReachState =
  | { status: 'idle' }
  | { status: 'loading'; previous: Reach | null }
  | { status: 'ready'; reach: Reach }
  | { status: 'error'; message: string }

const DEBOUNCE_MS = 150

export function useReach(
  routerUrl: string | null,
  start: LngLat | null,
  minutes: number,
  profile: Profile,
  enabled: boolean,
): ReachState {
  const [state, setState] = useState<ReachState>({ status: 'idle' })
  const key = enabled && routerUrl && start ? JSON.stringify([start, minutes, profile]) : null

  // biome-ignore lint/correctness/useExhaustiveDependencies: key captures every input that changes the result
  useEffect(() => {
    if (!key || !routerUrl || !start) {
      setState({ status: 'idle' })
      return
    }
    const controller = new AbortController()
    setState((current) => ({
      status: 'loading',
      previous: current.status === 'ready' ? current.reach : current.status === 'loading' ? current.previous : null,
    }))
    const timer = setTimeout(() => {
      fetchReach(routerUrl, start, minutes, profile, controller.signal)
        .then((reach) => setState({ status: 'ready', reach }))
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

/** The area to draw: the current one, or the last one while a new one loads. */
export function visibleReach(state: ReachState): Reach | null {
  if (state.status === 'ready') return state.reach
  if (state.status === 'loading') return state.previous
  return null
}
