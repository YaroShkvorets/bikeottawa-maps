import { isMessageKey, type Translate } from './i18n'

/** A tag value we have no words for, made readable: "drive_through" → "Drive through". */
function readable(value: string): string {
  const text = value.replaceAll('_', ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function label(prefix: string, value: string, t: Translate): string {
  const key = `${prefix}.${value}`
  return isMessageKey(key) ? t(key) : readable(value)
}

/**
 * What kind of way this is in plain words, from its OSM `highway` tag and the
 * sub-type that goes with it: "Service road · Driveway", "Primary road · Ramp".
 */
export function wayType(props: Record<string, unknown>, t: Translate): string {
  if (typeof props.highway !== 'string') return ''
  const highway = props.highway.replace(/_link$/, '')
  const parts = [label('highway', highway, t)]
  if (highway !== props.highway) parts.push(t('highway.link'))
  if (highway === 'service' && typeof props.service === 'string') parts.push(label('service', props.service, t))
  if (highway === 'footway' && typeof props.footway === 'string') parts.push(label('footway', props.footway, t))
  return parts.join(' · ')
}
