'use client';

import { useTenantConfig } from '@/lib/context/tenant-config';
import StaffBookingCard from './staff-booking-card';

interface BookingRow {
  id: string;
  slot_date: string;
  slot_start: string;
  slot_end: string;
  duration_minutes: number;
  booking_notes: string | null;
  status: string;
  clients: Array<{ display_name: string }> | { display_name: string } | null;
  guest_clients: Array<{ name: string }> | { name: string } | null;
  booking_service_tags: Array<{ tag_name: string }>;
}

function getClientName(booking: BookingRow): string {
  const client = Array.isArray(booking.clients) ? booking.clients[0] : booking.clients;
  const guest = Array.isArray(booking.guest_clients) ? booking.guest_clients[0] : booking.guest_clients;
  return client?.display_name ?? guest?.name ?? 'Unknown';
}

function toCardBooking(b: BookingRow) {
  return {
    id: b.id,
    slot_date: b.slot_date,
    slot_start: b.slot_start,
    slot_end: b.slot_end,
    duration_minutes: b.duration_minutes,
    booking_notes: b.booking_notes,
    tags: b.booking_service_tags?.map(t => t.tag_name) ?? [],
    clientName: getClientName(b),
  };
}

interface Props {
  slug: string;
  tenantName: string;
  pendingBookings: BookingRow[];
  upcomingBookings: BookingRow[];
}

export default function StaffDashboard({
  slug,
  tenantName,
  pendingBookings,
  upcomingBookings,
}: Props) {
  const { terminology } = useTenantConfig();
  const bookingLabel = terminology.booking;

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-white text-xl font-semibold">
            Your {terminology.booking_plural}
          </h1>
          <p className="text-zinc-500 text-sm mt-1">{tenantName}</p>
        </div>

        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-white text-sm font-medium">Pending Requests</h2>
            {pendingBookings.length > 0 && (
              <span className="bg-zinc-700 text-white text-[11px] font-medium px-2 py-0.5 rounded-full">
                {pendingBookings.length}
              </span>
            )}
          </div>
          {pendingBookings.length === 0 ? (
            <p className="text-zinc-600 text-sm">No pending requests.</p>
          ) : (
            <div className="space-y-3">
              {pendingBookings.map(b => (
                <StaffBookingCard
                  key={b.id}
                  slug={slug}
                  booking={toCardBooking(b)}
                  showActions={true}
                  bookingLabel={bookingLabel}
                />
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-white text-sm font-medium mb-4">Upcoming This Week</h2>
          {upcomingBookings.length === 0 ? (
            <p className="text-zinc-600 text-sm">No upcoming {terminology.booking_plural.toLowerCase()}.</p>
          ) : (
            <div className="space-y-3">
              {upcomingBookings.map(b => (
                <StaffBookingCard
                  key={b.id}
                  slug={slug}
                  booking={toCardBooking(b)}
                  showActions={false}
                  bookingLabel={bookingLabel}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
