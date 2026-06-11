const SIZES = { sm: 16, md: 24, lg: 32 } as const;

export type SpinnerSize = keyof typeof SIZES;

export default function Spinner({
  size = 'md',
  className = '',
}: {
  size?: SpinnerSize;
  className?: string;
}) {
  const px = SIZES[size];
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 24 24"
      fill="none"
      role="status"
      aria-label="Loading"
      className={`animate-spin stroke-current ${className}`}
    >
      <circle cx="12" cy="12" r="10" strokeWidth="3" className="opacity-25" />
      <path d="M12 2a10 10 0 0 1 10 10" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
