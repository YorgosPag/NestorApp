'use client';

/**
 * DeclineDialog — modal for vendor to decline an invite (Q23).
 * @module app/vendor/quote/[token]/DeclineDialog
 */

import React, { useState } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface Props {
  onConfirm: (reason: string | null) => Promise<void>;
  onCancel: () => void;
}

export function DeclineDialog({ onConfirm, onCancel }: Props) {
  const { t } = useTranslation(['vendor-portal']);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await onConfirm(reason.trim() || null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-card/40 px-4 py-6 sm:items-center"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <header className="border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-foreground">{t('vendor-portal:decline.title')}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{t('vendor-portal:decline.subtitle')}</p>
        </header>
        <div className="px-5 py-4">
          <label className="text-xs font-medium text-foreground">
            {t('vendor-portal:decline.reasonLabel')}
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('vendor-portal:decline.reasonPlaceholder')}
            rows={3}
            className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
            maxLength={1000}
          />
        </div>
        <footer className="flex justify-end gap-2 border-t border-border bg-muted px-5 py-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-md border border-border bg-white px-3 py-1.5 text-sm text-foreground hover:bg-accent disabled:opacity-50"
          >
            {t('vendor-portal:decline.cancel')}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="rounded-md bg-destructive px-3 py-1.5 text-sm font-semibold text-white hover:bg-destructive/90 disabled:opacity-50"
          >
            {t('vendor-portal:decline.confirm')}
          </button>
        </footer>
      </div>
    </div>
  );
}
