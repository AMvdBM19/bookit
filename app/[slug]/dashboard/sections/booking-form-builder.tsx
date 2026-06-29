'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import Modal from '@/components/ui/modal';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import Spinner from '@/components/ui/spinner';
import {
  type BookingField,
  type BookingFieldType,
  OPTION_FIELD_TYPES,
  FIELD_TYPE_LABELS,
  LEGACY_FIELD_KEYS,
} from '@/lib/types/booking-fields';

const inputCls =
  'w-full text-sm bg-elevated text-fg border border-border rounded px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const labelCls = 'block text-xs text-fg-muted mb-1';

interface FieldDraft {
  label: string;
  field_type: BookingFieldType;
  required: boolean;
  placeholder: string;
  help_text: string;
  optionsText: string; // one option per line
}

const EMPTY_DRAFT: FieldDraft = {
  label: '',
  field_type: 'text',
  required: false,
  placeholder: '',
  help_text: '',
  optionsText: '',
};

/**
 * Phase 20-C3: the "Booking form" builder. Lists a tenant's custom booking
 * fields with reorder / edit / activate / delete, and an Add modal supporting
 * all 8 field types. Talks to /api/{slug}/booking-fields.
 */
export default function BookingFormBuilder({
  slug,
  onChanged,
}: {
  slug: string;
  /** Called after any successful field mutation (e.g. to refresh a preview). */
  onChanged?: () => void;
}) {
  const [fields, setFields] = useState<BookingField[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<BookingField | null>(null);
  const [deleting, setDeleting] = useState<BookingField | null>(null);

  const reload = useCallback(async () => {
    try {
      const res = await fetch(`/api/${slug}/booking-fields`);
      const data = await res.json().catch(() => ({}));
      if (res.ok) setFields(data.fields ?? []);
      else setFields([]);
    } catch {
      setFields([]);
    }
  }, [slug]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function patch(id: string, body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/${slug}/booking-fields`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Couldn't save the field.");
        return false;
      }
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function move(index: number, dir: -1 | 1) {
    if (!fields) return;
    const target = index + dir;
    if (target < 0 || target >= fields.length) return;
    const a = fields[index];
    const b = fields[target];
    // Swap display_order on both.
    const okA = await patch(a.id, { display_order: b.display_order });
    const okB = await patch(b.id, { display_order: a.display_order });
    if (okA && okB) {
      await reload();
      onChanged?.();
    }
  }

  async function toggleActive(field: BookingField) {
    if (await patch(field.id, { is_active: !field.is_active })) {
      await reload();
      onChanged?.();
    }
  }

  async function remove(field: BookingField) {
    setBusy(true);
    try {
      const res = await fetch(`/api/${slug}/booking-fields?id=${field.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Couldn't delete the field.");
        return;
      }
      toast.success('Field deleted.');
      await reload();
      onChanged?.();
    } finally {
      setBusy(false);
      setDeleting(null);
    }
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-fg-muted uppercase tracking-wider">Booking form</h3>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="text-xs px-3 py-1 bg-fg text-canvas rounded hover:opacity-90 transition-opacity"
        >
          + Add field
        </button>
      </div>
      <p className="text-[11px] text-fg-muted mb-2">
        Extra questions shown to clients on the booking form, in this order.
      </p>

      <div className="bg-surface rounded-lg border border-border">
        {fields === null ? (
          <div className="flex justify-center py-8 text-fg-muted">
            <Spinner size="md" />
          </div>
        ) : fields.length === 0 ? (
          <p className="text-sm text-fg-muted px-4 py-6 text-center">
            No custom fields yet. Add one to collect extra info at booking time.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {fields.map((f, i) => {
              const isLegacy = (LEGACY_FIELD_KEYS as readonly string[]).includes(f.field_key);
              return (
                <li key={f.id} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => move(i, -1)}
                      disabled={busy || i === 0}
                      aria-label="Move up"
                      className="text-fg-muted hover:text-fg disabled:opacity-30 text-xs leading-none"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      onClick={() => move(i, 1)}
                      disabled={busy || i === fields.length - 1}
                      aria-label="Move down"
                      className="text-fg-muted hover:text-fg disabled:opacity-30 text-xs leading-none"
                    >
                      ▼
                    </button>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-fg truncate">
                      {f.label}
                      {f.required && <span className="text-red-500 ml-1">*</span>}
                      {!f.is_active && <span className="text-[10px] text-fg-subtle ml-2">(hidden)</span>}
                    </p>
                    <p className="text-[11px] text-fg-muted">
                      {FIELD_TYPE_LABELS[f.field_type]}
                      {isLegacy && ' · built-in'}
                      {f.options && f.options.length > 0 && ` · ${f.options.length} options`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleActive(f)}
                      disabled={busy}
                      className="text-xs px-2 py-1 bg-elevated hover:bg-sunken text-fg rounded"
                    >
                      {f.is_active ? 'Hide' : 'Show'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(f)}
                      className="text-xs px-2 py-1 bg-elevated hover:bg-sunken text-fg rounded"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleting(f)}
                      className="text-xs px-2 py-1 bg-elevated hover:bg-sunken text-red-500 rounded"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {showAdd && (
        <FieldModal
          slug={slug}
          mode="add"
          onClose={() => setShowAdd(false)}
          onSaved={() => {
            setShowAdd(false);
            reload();
            onChanged?.();
          }}
        />
      )}

      {editing && (
        <FieldModal
          slug={slug}
          mode="edit"
          field={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
            onChanged?.();
          }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete this field?"
          description={`"${deleting.label}" will be removed from the booking form. Existing bookings keep their stored values.`}
          confirmLabel="Delete field"
          onConfirm={() => remove(deleting)}
          onClose={() => setDeleting(null)}
        />
      )}
    </section>
  );
}

function FieldModal({
  slug,
  mode,
  field,
  onClose,
  onSaved,
}: {
  slug: string;
  mode: 'add' | 'edit';
  field?: BookingField;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<FieldDraft>(() =>
    field
      ? {
          label: field.label,
          field_type: field.field_type,
          required: field.required,
          placeholder: field.placeholder ?? '',
          help_text: field.help_text ?? '',
          optionsText: (field.options ?? []).join('\n'),
        }
      : EMPTY_DRAFT
  );
  const [saving, setSaving] = useState(false);

  const needsOptions = OPTION_FIELD_TYPES.includes(draft.field_type);
  // field_type and field_key are immutable once created.
  const typeLocked = mode === 'edit';

  function set<K extends keyof FieldDraft>(key: K, value: FieldDraft[K]) {
    setDraft(prev => ({ ...prev, [key]: value }));
  }

  async function save() {
    if (!draft.label.trim()) {
      toast.error('A label is required.');
      return;
    }
    const options = draft.optionsText
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean);
    if (needsOptions && options.length === 0) {
      toast.error('Add at least one option.');
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        label: draft.label.trim(),
        required: draft.required,
        placeholder: draft.placeholder.trim(),
        help_text: draft.help_text.trim(),
      };
      if (needsOptions) body.options = options;

      let res: Response;
      if (mode === 'add') {
        res = await fetch(`/api/${slug}/booking-fields`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...body, field_type: draft.field_type }),
        });
      } else {
        res = await fetch(`/api/${slug}/booking-fields`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: field!.id, ...body }),
        });
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Couldn't save the field.");
        return;
      }
      toast.success(mode === 'add' ? 'Field added.' : 'Field updated.');
      onSaved();
    } catch {
      toast.error("Couldn't save the field.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={mode === 'add' ? 'Add field' : 'Edit field'} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className={labelCls}>Label</label>
          <input
            type="text"
            value={draft.label}
            onChange={e => set('label', e.target.value)}
            className={inputCls}
            placeholder="e.g. Vehicle registration"
            maxLength={120}
          />
        </div>

        <div>
          <label className={labelCls}>Type</label>
          <select
            value={draft.field_type}
            onChange={e => set('field_type', e.target.value as BookingFieldType)}
            disabled={typeLocked}
            className={inputCls + (typeLocked ? ' opacity-60 cursor-not-allowed' : '')}
          >
            {(Object.keys(FIELD_TYPE_LABELS) as BookingFieldType[]).map(ft => (
              <option key={ft} value={ft}>
                {FIELD_TYPE_LABELS[ft]}
              </option>
            ))}
          </select>
          {typeLocked && (
            <p className="text-[11px] text-fg-subtle mt-1">Type can&apos;t be changed after creation.</p>
          )}
        </div>

        {needsOptions && (
          <div>
            <label className={labelCls}>Options (one per line)</label>
            <textarea
              value={draft.optionsText}
              onChange={e => set('optionsText', e.target.value)}
              className={inputCls + ' h-24 resize-none'}
              placeholder={'Option A\nOption B'}
            />
          </div>
        )}

        {draft.field_type !== 'file' && draft.field_type !== 'date' && !needsOptions && (
          <div>
            <label className={labelCls}>Placeholder</label>
            <input
              type="text"
              value={draft.placeholder}
              onChange={e => set('placeholder', e.target.value)}
              className={inputCls}
              maxLength={200}
            />
          </div>
        )}

        <div>
          <label className={labelCls}>Help text</label>
          <input
            type="text"
            value={draft.help_text}
            onChange={e => set('help_text', e.target.value)}
            className={inputCls}
            placeholder="Optional hint shown under the field"
            maxLength={300}
          />
        </div>

        <label className="flex items-center gap-2 cursor-pointer text-sm text-fg">
          <input
            type="checkbox"
            checked={draft.required}
            onChange={e => set('required', e.target.checked)}
          />
          Required
        </label>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="text-sm px-3 py-1.5 text-fg hover:bg-elevated rounded"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="text-sm px-4 py-1.5 bg-fg text-canvas rounded hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? 'Saving…' : mode === 'add' ? 'Add field' : 'Save changes'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
