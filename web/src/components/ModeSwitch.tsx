import { useI18n } from '../i18n'

export type Mode = 'explore' | 'route' | 'reach'

interface Props {
  mode: Mode
  onChange: (mode: Mode) => void
}

export function ModeSwitch({ mode, onChange }: Props) {
  const { t } = useI18n()
  return (
    <div className="mode-switch">
      {(['explore', 'route', 'reach'] as const).map((id) => (
        <button key={id} type="button" aria-pressed={id === mode} onClick={() => onChange(id)}>
          {t(`mode.${id}`)}
        </button>
      ))}
    </div>
  )
}
