import { cx } from './cx';

export interface TabItem {
  id: string;
  label: React.ReactNode;
}

interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  variant?: 'folder' | 'segment';
  className?: string;
}

// folder: 카드 상단에 붙는 폴더탭(활성 어두움). segment: 알약형 토글([편집|플레이]).
export function Tabs({ items, value, onChange, variant = 'folder', className }: TabsProps) {
  if (variant === 'segment') {
    return (
      <div className={cx('inline-flex border border-line rounded-full overflow-hidden', className)}>
        {items.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={cx(
              'px-4 py-1.5 text-xs font-bold transition-colors',
              t.id === value ? 'bg-primary text-primary-ink' : 'bg-surface text-ink-muted hover:bg-surface-2',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
    );
  }

  // folder
  return (
    <div className={cx('flex', className)}>
      {items.map((t, i) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={cx(
            'flex-1 py-2.5 text-xs font-bold transition-colors border-b',
            i < items.length - 1 && 'border-r border-r-line',
            t.id === value
              ? 'bg-[#1f2937] text-white border-b-[#1f2937]'
              : 'bg-surface text-ink-muted border-b-line hover:bg-surface-2',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
