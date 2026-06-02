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
        className="rounded-lg border p-6 text-center"
        style={{
          borderColor: confirmed ? brandColor : '#3f3f46',
          backgroundColor: confirmed ? `${brandColor}15` : '#18181b',
        }}
      >
        <p className="text-white text-base font-semibold mb-1">{headline}</p>
        <p className="text-zinc-400 text-xs">{subline}</p>
        <p className="text-zinc-600 text-[10px] font-mono mt-3">
          Ref: {bookingId.slice(0, 8)}
        </p>
      </div>

      <button
        type="button"
        onClick={onBookAnother}
        className="w-full bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg py-2 text-sm transition-colors"
      >
        Book another
      </button>
    </div>
  );
}
