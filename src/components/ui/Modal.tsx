import { useEffect } from 'react';
import { cx } from './cx';

interface ModalProps {
  title: React.ReactNode;
  onClose: () => void;
  width?: 'sm' | 'md';
  footer?: React.ReactNode;
  dismissable?: boolean; // false면 Esc/백드롭 닫기 비활성
  children: React.ReactNode;
}

const WIDTHS = { sm: 'w-80', md: 'w-96' } as const;

export function Modal({
  title, onClose, width = 'sm', footer, dismissable = true, children,
}: ModalProps) {
  useEffect(() => {
    if (!dismissable) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [dismissable, onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={dismissable ? onClose : undefined}
    >
      <div
        className={cx('bg-surface text-ink rounded-xl shadow-xl p-6 flex flex-col gap-4', WIDTHS[width])}
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-ink">{title}</h3>
        {children}
        {footer && <div className="flex gap-2 justify-end">{footer}</div>}
      </div>
    </div>
  );
}
