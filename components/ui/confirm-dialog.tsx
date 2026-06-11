'use client';

import { useState } from 'react';
import Modal from './modal';
import Button, { type ButtonVariant } from './button';

export default function ConfirmDialog({
  title,
  description,
  confirmLabel = 'Confirm',
  confirmVariant = 'destructive',
  onConfirm,
  onClose,
}: {
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  confirmVariant?: ButtonVariant;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function handleConfirm() {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={title} description={description} onClose={onClose} maxWidth="max-w-sm">
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" size="md" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button variant={confirmVariant} size="md" onClick={handleConfirm} loading={busy}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
