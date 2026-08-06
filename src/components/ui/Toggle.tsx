import { cx } from './cx';

interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** 스위치 왼쪽에 붙는 라벨. 없으면 aria-label 로 접근성을 채울 것 */
  label?: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
  'aria-label'?: string;
  className?: string;
}

// 토큰 기반 on/off 스위치. 설정 화면의 불리언 항목 공용 프리미티브.
export function Toggle({
  checked, onChange, label, description, disabled = false, className, ...rest
}: ToggleProps) {
  const knob = (
    <span
      className={cx(
        'relative inline-flex w-10 h-6 shrink-0 rounded-full transition-colors',
        'border border-line',
        checked ? 'bg-primary' : 'bg-surface-3',
        disabled && 'opacity-50',
      )}
    >
      <span
        className={cx(
          'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-card transition-transform',
          checked && 'translate-x-4',
        )}
      />
    </span>
  );

  const button = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        'inline-flex items-center gap-3 text-left rounded transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        'disabled:pointer-events-none',
        label ? 'w-full justify-between' : '',
        className,
      )}
      {...rest}
    >
      {label && (
        <span className="flex flex-col gap-0.5 min-w-0">
          <span className="text-sm font-medium text-ink">{label}</span>
          {description && (
            <span className="text-xs text-ink-muted">{description}</span>
          )}
        </span>
      )}
      {knob}
    </button>
  );

  return button;
}
