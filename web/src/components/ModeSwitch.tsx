import { useI18n } from '../i18n'
import { ExploreIcon, ReachIcon, RouteIcon } from './icons'

export type Mode = 'explore' | 'route' | 'reach'

const ICONS = { explore: ExploreIcon, route: RouteIcon, reach: ReachIcon }

interface Props {
  mode: Mode
  onChange: (mode: Mode) => void
}

export function ModeSwitch({ mode, onChange }: Props) {
  const { t } = useI18n()
  return (
    <div className="mode-switch">
      {(['explore', 'route', 'reach'] as const).map((id) => {
        const Icon = ICONS[id]
        return (
          <button key={id} type="button" aria-pressed={id === mode} onClick={() => onChange(id)}>
            <Icon />
            {t(`mode.${id}`)}
          </button>
        )
      })}
    </div>
  )
}
