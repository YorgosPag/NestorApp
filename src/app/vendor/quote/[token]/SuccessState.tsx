'use client';

/**
 * SuccessState — shown after a successful submission (or edit) within the
 * 72h edit window. Vendor can re-open and edit until the window closes.
 *
 * @module app/vendor/quote/[token]/SuccessState
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface Props {
  editWindowExpiresAt: string | null;
  locale: 'el' | 'en';
  onEditAgain: () => void;
}

export function SuccessState({ editWindowExpiresAt, locale, onEditAgain }: Props) {
  const { t } = useTranslation(['vendor-portal']);
  const formatted = editWindowExpiresAt
    ? new Date(editWindowExpiresAt).toLocaleString(locale)
    : '—';

  return (
    <section className="rounded-lg border border-[hsl(var(--text-success))]/60 bg-white p-6 text-center shadow-sm">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--bg-success))]/40 text-[hsl(var(--text-success))]">
        ✓
      </div>
      <h2 className="text-lg font-semibold text-foreground">{t('vendor-portal:success.title')}</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {t('vendor-portal:success.body', { editWindowExpiresAt: formatted })}
      </p>
      <button
        type="button"
        onClick={onEditAgain}
        className="mt-5 rounded-md border border-border bg-white px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
      >
        {t('vendor-portal:success.viewAgain')}
      </button>
    </section>
  );
}
