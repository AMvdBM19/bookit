'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useTenantConfig } from '@/lib/context/tenant-config';
import Badge from '@/components/ui/badge';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import { PaymentStatusBadge, type BookingDetail } from './booking-detail-panel';

interface JoinObj {
  pseudonym?: string;
  display_name?: string;
  name?: string;
}
interface KanbanBooking extends BookingDetail {
  staff: JoinObj | JoinObj[] | null;
  clients: JoinObj | JoinObj[] | null;
  guest_clients: JoinObj | JoinObj[] | null;
}

function pickOne<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}
function clientNameOf(b: KanbanBooking): string {
  return pickOne(b.clients)?.display_name ?? pickOne(b.guest_clients)?.name ?? 'Unknown';
}
function staffNameOf(b: KanbanBooking): string | null {
  return pickOne(b.staff)?.pseudonym ?? null;
}
function money(amount: number | string | null | undefined, currency: string): string | null {
  const n = Number(amount);
  if (amount == null || !Number.isFinite(n) || n === 0) return null;
  try {
    return new Intl.NumberFormat('en-IE', { style: 'currency', currency: currency || 'EUR' }).format(n);
  } catch {
    return `${currency || 'EUR'} ${n.toFixed(2)}`;
  }
}

// Columns and their card accent. completed/no_show/cancelled collapse by default.
const COLUMNS: Array<{ key: string; label: string; variant: 'warning' | 'success' | 'info' | 'danger' | 'default'; collapsedByDefault?: boolean }> = [
  { key: 'pending_staff', label: 'Pending', variant: 'warning' },
  { key: 'confirmed', label: 'Confirmed', variant: 'success' },
  { key: 'completed', label: 'Completed', variant: 'info', collapsedByDefault: true },
  { key: 'no_show', label: 'No-show', variant: 'danger', collapsedByDefault: true },
  { key: 'cancelled', label: 'Cancelled', variant: 'default', collapsedByDefault: true },
];

// Allowed status transitions (state machine). completed/no_show are time-gated.
const ALLOWED: Record<string, string[]> = {
  pending_staff: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'no_show', 'cancelled'],
};

function hasEnded(b: KanbanBooking): boolean {
  return new Date(`${b.slot_date}T${b.slot_end}`) < new Date();
}

export default function BookingsKanban({
  bookings,
  currency,
  staffOptions,
  onAssign,
  onStatus,
  onEdit,
  onViewDetails,
}: {
  bookings: KanbanBooking[];
  currency: string;
  staffOptions: Array<{ id: string; pseudonym: string }>;
  onAssign: (id: string, staffId: string) => Promise<void>;
  onStatus: (id: string, target: string, reason?: string) => Promise<boolean>;
  onEdit: (id: string) => void;
  onViewDetails: (b: KanbanBooking) => void;
}) {
  const { terminology } = useTenantConfig();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(COLUMNS.filter(c => c.collapsedByDefault).map(c => [c.key, true]))
  );
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const byStatus = (status: string) => bookings.filter(b => b.status === status);

  function validateMove(b: KanbanBooking, target: string): string | null {
    if (b.status === target) return null;
    if (!ALLOWED[b.status]?.includes(target)) {
      return `Cannot move a ${b.status.replace('_', ' ')} ${terminology.booking.toLowerCase()} there.`;
    }
    if ((target === 'completed' || target === 'no_show') && !hasEnded(b)) {
      return "Booking hasn't ended yet.";
    }
    return null;
  }

  async function handleDrop(target: string) {
    const id = dragId;
    setDragId(null);
    setDragOver(null);
    if (!id) return;
    const b = bookings.find(x => x.id === id);
    if (!b || b.status === target) return;

    const err = validateMove(b, target);
    if (err) {
      toast.error(err);
      return;
    }
    if (target === 'cancelled') {
      setCancelId(id); // confirm + optional reason
      return;
    }
    await onStatus(id, target);
  }

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex gap-3 min-w-max">
        {COLUMNS.map(col => {
          const items = byStatus(col.key);
          const isCollapsed = collapsed[col.key];
          return (
            <div
              key={col.key}
              onDragOver={e => {
                e.preventDefault();
                setDragOver(col.key);
              }}
              onDragLeave={() => setDragOver(prev => (prev === col.key ? null : prev))}
              onDrop={() => handleDrop(col.key)}
              className={`w-64 shrink-0 rounded-lg border bg-surface ${
                dragOver === col.key ? 'border-fg border-dashed' : 'border-border'
              }`}
            >
              <button
                type="button"
                onClick={() => setCollapsed(prev => ({ ...prev, [col.key]: !prev[col.key] }))}
                className="w-full flex items-center justify-between px-3 py-2 border-b border-border"
              >
                <span className="inline-flex items-center gap-2">
                  <Badge variant={col.variant}>{col.label}</Badge>
                  <span className="text-xs text-fg-muted">{items.length}</span>
                </span>
                <span className="text-fg-subtle text-xs">{isCollapsed ? '▸' : '▾'}</span>
              </button>

              {!isCollapsed && (
                <div className="p-2 space-y-2 min-h-[60px]">
                  {items.length === 0 ? (
                    <p className="text-[11px] text-fg-subtle text-center py-3">—</p>
                  ) : (
                    items.map(b => (
                      <KanbanCard
                        key={b.id}
                        b={b}
                        currency={currency}
                        staffOptions={staffOptions}
                        draggable={!!ALLOWED[b.status]}
                        onDragStart={() => setDragId(b.id)}
                        onDragEnd={() => setDragId(null)}
                        onAssign={onAssign}
                        onStatus={onStatus}
                        onCancel={() => {
                          setCancelReason('');
                          setCancelId(b.id);
                        }}
                        onEdit={onEdit}
                        onViewDetails={onViewDetails}
                      />
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {cancelId && (
        <ConfirmDialog
          title={`Cancel this ${terminology.booking.toLowerCase()}?`}
          description={
            <div className="space-y-2">
              <p>The {terminology.client.toLowerCase()} will be notified of the cancellation.</p>
              <input
                type="text"
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                placeholder="Reason (optional)"
                className="w-full text-sm bg-elevated text-fg border border-border rounded px-3 py-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          }
          confirmLabel="Cancel booking"
          onConfirm={async () => {
            const id = cancelId;
            setCancelId(null);
            if (id) await onStatus(id, 'cancelled', cancelReason || undefined);
          }}
          onClose={() => setCancelId(null)}
        />
      )}
    </div>
  );
}

function KanbanCard({
  b,
  currency,
  staffOptions,
  draggable,
  onDragStart,
  onDragEnd,
  onAssign,
  onStatus,
  onCancel,
  onEdit,
  onViewDetails,
}: {
  b: KanbanBooking;
  currency: string;
  staffOptions: Array<{ id: string; pseudonym: string }>;
  draggable: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onAssign: (id: string, staffId: string) => Promise<void>;
  onStatus: (id: string, target: string, reason?: string) => Promise<boolean>;
  onCancel: () => void;
  onEdit: (id: string) => void;
  onViewDetails: (b: KanbanBooking) => void;
}) {
  const { terminology } = useTenantConfig();
  const staffName = staffNameOf(b);
  const isPool = !staffName && b.status === 'pending_staff';
  const ended = hasEnded(b);
  const total = money(b.total_price, currency);
  const editable = ['pending_staff', 'confirmed', 'completed'].includes(b.status);

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`rounded-lg border border-border bg-canvas p-2.5 text-xs space-y-1.5 ${
        draggable ? 'cursor-grab active:cursor-grabbing' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-fg">{b.slot_start?.slice(0, 5)}</span>
        <span className="text-fg-subtle text-[10px]">
          {b.source === 'manual' ? 'Manual' : 'Widget'}
        </span>
      </div>
      <p className="text-fg truncate">{clientNameOf(b)}</p>
      <p className="text-fg-muted truncate">
        {staffName ?? <span className="text-amber-600 dark:text-amber-400">Unassigned</span>}
      </p>

      {b.booking_service_tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {b.booking_service_tags.slice(0, 3).map(t => (
            <span key={t.tag_name} className="bg-elevated border border-border rounded px-1 py-0.5 text-[10px] text-fg-muted">
              {t.tag_name}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        {total && <span className="text-fg-muted">{total}</span>}
        <PaymentStatusBadge status={b.payment_status} />
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-1 pt-1 border-t border-border">
        {isPool && staffOptions.length > 0 && (
          <select
            defaultValue=""
            onChange={e => {
              if (e.target.value) onAssign(b.id, e.target.value);
            }}
            className="text-[10px] bg-elevated text-fg border border-border rounded px-1 py-0.5 max-w-[90px]"
            aria-label="Assign staff"
          >
            <option value="">Assign…</option>
            {staffOptions.map(s => (
              <option key={s.id} value={s.id}>
                {s.pseudonym}
              </option>
            ))}
          </select>
        )}
        {b.status === 'confirmed' && ended && (
          <>
            <button
              type="button"
              onClick={() => onStatus(b.id, 'completed')}
              className="text-[10px] px-1.5 py-0.5 bg-elevated hover:bg-sunken text-fg rounded"
            >
              Done
            </button>
            <button
              type="button"
              onClick={() => onStatus(b.id, 'no_show')}
              className="text-[10px] px-1.5 py-0.5 bg-elevated hover:bg-sunken text-fg rounded"
            >
              No-show
            </button>
          </>
        )}
        {(b.status === 'pending_staff' || b.status === 'confirmed') && (
          <button
            type="button"
            onClick={onCancel}
            className="text-[10px] px-1.5 py-0.5 bg-elevated hover:bg-sunken text-fg rounded"
          >
            Cancel
          </button>
        )}
        {editable && (
          <button
            type="button"
            onClick={() => onEdit(b.id)}
            className="text-[10px] px-1.5 py-0.5 bg-elevated hover:bg-sunken text-fg rounded"
          >
            Edit
          </button>
        )}
        <button
          type="button"
          onClick={() => onViewDetails(b)}
          className="text-[10px] px-1.5 py-0.5 bg-elevated hover:bg-sunken text-fg rounded"
        >
          Details
        </button>
      </div>
    </div>
  );
}
