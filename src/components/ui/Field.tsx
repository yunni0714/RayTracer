import { cx } from './cx';

const FIELD_BASE =
  'w-full border border-line rounded px-3 py-2 text-sm bg-surface text-ink ' +
  'placeholder:text-ink-muted focus:outline-none focus:border-primary ' +
  'read-only:bg-surface-2 disabled:bg-surface-2';

export function Label({ className, ...rest }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cx('text-sm font-medium text-ink', className)} {...rest} />;
}

export function TextInput({ className, ...rest }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(FIELD_BASE, className)} {...rest} />;
}

export function TextArea({ className, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(FIELD_BASE, 'resize-none', className)} {...rest} />;
}

export function Select({ className, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cx(FIELD_BASE, className)} {...rest} />;
}
