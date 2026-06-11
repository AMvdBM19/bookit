import Button from './button';

export default function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-4 border border-dashed border-border rounded-lg bg-surface">
      {icon && (
        <div className="w-10 h-10 rounded-full bg-elevated text-fg-muted flex items-center justify-center mb-3">
          {icon}
        </div>
      )}
      <p className="text-sm font-medium text-fg">{title}</p>
      {description && <p className="text-xs text-fg-muted mt-1 max-w-xs">{description}</p>}
      {actionLabel && onAction && (
        <Button variant="primary" size="md" onClick={onAction} className="mt-4">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
