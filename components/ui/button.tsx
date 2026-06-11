import Spinner from './spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'ghost' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-fg text-canvas hover:opacity-90 transition-opacity',
  secondary: 'bg-elevated hover:bg-sunken text-fg transition-colors',
  destructive: 'bg-red-600 hover:bg-red-500 text-white transition-colors',
  ghost: 'text-fg-muted hover:text-fg hover:bg-elevated transition-colors',
  outline: 'border border-border bg-transparent hover:bg-elevated text-fg transition-colors',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'text-xs px-2 py-1',
  md: 'text-sm px-3 py-1.5',
  lg: 'text-sm px-4 py-2',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className = '',
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-1.5 rounded font-medium disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    >
      {loading && <Spinner size="sm" className="shrink-0" />}
      {children}
    </button>
  );
}
