'use client';

interface Props {
  status: string;
  message: string;
  bookingId: string;
  bookingLabel: string;
  staffName: string;
  onBookAnother: () => void;
  brandColor: string;
}

export default function BookingSuccess({
  status,
  message,
  bookingId,
  bookingLabel,
  staffName,
  onBookAnother,
  brandColor,
}: Props) {
  const confirmed = status === 'confirmed';
  const headline = confirmed
    ? `Your ${bookingLabel.toLowerCase()} is confirmed!`
    : 'Request submitted';
  const subline = confirmed
    ? message
    : `${staffName} will review and confirm shortly.`;

  return (
    <div className="space-y-4">
      <div
        className="w-round border w-pad-lg text-center"
        style={{
          borderColor: confirmed ? brandColor : 'var(--w-border-strong)',
          backgroundColor: confirmed
            ? 'color-mix(in srgb, var(--w-primary) 8%, transparent)'
            : 'var(--w-surface)',
        }}
      >
        <p className="w-tx text-base font-semibold mb-1">{headline}</p>
        <p className="w-tx2 text-xs">{subline}</p>
        <p className="w-tx3 text-[10px] font-mono mt-3">
          Ref: {bookingId.slice(0, 8)}
        </p>
      </div>

      <button
        type="button"
        onClick={onBookAnother}
        className="w-full w-btn2 w-round py-2 text-sm transition-colors"
      >
        Book another
      </button>
    </div>
  );
}
