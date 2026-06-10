import { cx } from './cx';

export type ButtonVariant =
  | 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'accent' | 'ghost';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
  block?: boolean;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary:   'bg-primary text-primary-ink hover:opacity-90',
  secondary: 'bg-surface-2 text-ink border border-line hover:bg-surface-3',
  success:   'bg-success text-white hover:opacity-90',
  danger:    'bg-danger text-white hover:opacity-90',
  warning:   'bg-warning text-white hover:opacity-90',
  accent:    'bg-accent text-white hover:opacity-90',
  ghost:     'text-ink-muted hover:bg-surface-2',
};

const SIZES = {
  sm: 'text-sm px-3 py-1.5',
  md: 'text-sm px-4 py-2',
} as const;

const BASE =
  'inline-flex items-center justify-center gap-2 font-medium rounded transition-colors ' +
  'disabled:opacity-50 disabled:pointer-events-none ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary';

export function Button({
  variant = 'primary', size = 'sm', block = false, className, type = 'button', ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(BASE, SIZES[size], VARIANTS[variant], block && 'w-full', className)}
      {...rest}
    />
  );
}
