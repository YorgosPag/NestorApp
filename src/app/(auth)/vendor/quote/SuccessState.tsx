'use client';

/**
 * SuccessState — shown after a successful submission (or edit). Re-opening for edit is offered
 * ONLY when the server's `permits.submit` says so (ADR-876 §5 Σ16) — after the window closes the
 * page says so instead of promising an edit the server would refuse.
 *
 * @module app/(auth)/vendor/quote/SuccessState
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface Props {
  editWindowExpiresAt: string | null;
  locale: 'el' | 'en';
  /** `null` ⇒ το παράθυρο επεξεργασίας έκλεισε: κανένα κουμπί, άλλο κείμενο. */
  onEditAgain: (() => void) | null;
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
        {t(onEditAgain ? 'vendor-portal:success.body' : 'vendor-portal:success.bodyClosed', {
          editWindowExpiresAt: formatted,
        })}
      </p>
      {onEditAgain && (
        <button
          type="button"
          onClick={onEditAgain}
          className="mt-5 rounded-md border border-border bg-white px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
        >
          {t('vendor-portal:success.viewAgain')}
        </button>
      )}
    </section>
  );
}
