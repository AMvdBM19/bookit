'use client';

import { useEffect } from 'react';

export interface ModalProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  /** Tailwind max-width class for the card. Defaults to max-w-md. */
  maxWidth?: string;
}

export default function Modal({
  title,
  description,
  onClose,
  children,
  maxWidth = 'max-w-md',
}: ModalProps) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-modal-overlay"
      onMouseDown={e => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`bg-surface border border-border rounded-xl shadow-xl w-full ${maxWidth} p-6 max-h-[90vh] overflow-y-auto animate-modal-card`}
      >
        {(title || description) && (
          <div className="mb-4">
            <div className="flex items-center justify-between">
              {title && <h3 className="text-base font-semibold text-fg">{title}</h3>}
              <button
                type="button"
                onClick={onClose}
                className="text-fg-muted hover:text-fg rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            {description && <p className="text-sm text-fg-muted mt-1.5">{description}</p>}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
