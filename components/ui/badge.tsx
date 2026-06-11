export type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'outline';
export type BadgeSize = 'sm' | 'md';

const VARIANTS: Record<BadgeVariant, string> = {
  default: 'bg-elevated text-fg-muted border-border',
  success:
    'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30',
  warning:
    'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30',
  danger:
    'bg-red-100 text-red-800 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30',
  info: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/30',
  outline: 'bg-sunken text-fg-muted border-border-strong',
};

const SIZES: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-[10px]',
  md: 'px-2.5 py-0.5 text-[11px]',
};

export default function Badge({
  variant = 'default',
  size = 'sm',
  className = '',
  children,
}: {
  variant?: BadgeVariant;
  size?: BadgeSize;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-block font-medium uppercase tracking-wider rounded border ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    >
      {children}
    </span>
  );
}
