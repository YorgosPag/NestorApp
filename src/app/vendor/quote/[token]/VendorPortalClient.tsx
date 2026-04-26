'use client';

/**
 * VendorPortalClient — Mobile-first vendor quote submission UI.
 *
 * Public, no auth. Token is bound on the URL. Uses internal API routes
 * `/api/vendor/quote/[token]` for GET (re-fetch on language switch) and
 * POST (submit / edit), and `/decline` for declines.
 *
 * @module app/vendor/quote/[token]/VendorPortalClient
 * @enterprise ADR-327 §7 — Phase 3 Vendor Portal
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { i18n } from 'i18next';
import { VendorPortalForm } from './VendorPortalForm';
import { DeclineDialog } from './DeclineDialog';
import { SuccessState } from './SuccessState';
import type { InitialData, QuoteLineDraft, QuoteSnapshot } from './types';

interface Props {
  token: string;
  initialData: InitialData;
}

type Phase = 'editing' | 'submitting' | 'submitted' | 'declined' | 'declining';

export function VendorPortalClient({ token, initialData }: Props) {
  const { t, i18n: instance } = useTranslation(['vendor-portal']);
  const [locale, setLocale] = useState<'el' | 'en'>(
    instance.language === 'en' ? 'en' : 'el',
  );
  const [phase, setPhase] = useState<Phase>(
    initialData.invite.status === 'submitted' && initialData.invite.editWindowOpen
      ? 'editing'
      : initialData.invite.status === 'submitted'
        ? 'submitted'
        : 'editing',
  );
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [errorReason, setErrorReason] = useState<string | null>(null);
  const [existingQuote, setExistingQuote] = useState<QuoteSnapshot | null>(null);
  const [submittedAt, setSubmittedAt] = useState<string | null>(
    initialData.invite.editWindowExpiresAt ?? null,
  );

  const formattedExpiresAt = useMemo(
    () => new Date(initialData.invite.expiresAt).toLocaleString(locale),
    [initialData.invite.expiresAt, locale],
  );

  // Hydrate existing quote (edit mode) by calling the GET endpoint once.
  useEffect(() => {
    if (initialData.invite.status !== 'submitted') return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/vendor/quote/${encodeURIComponent(token)}`);
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled || !json?.success) return;
        setExistingQuote(json.data?.quote ?? null);
      } catch {
        // Non-fatal; user can still re-enter data.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, initialData.invite.status]);

  const switchLanguage = async () => {
    const next: 'el' | 'en' = locale === 'el' ? 'en' : 'el';
    setLocale(next);
    try {
      await (instance as i18n).changeLanguage(next);
    } catch {
      // Ignore — locale state above already reflects user choice
    }
  };

  const initialLines: QuoteLineDraft[] = useMemo(() => {
    if (existingQuote?.lines?.length) {
      return existingQuote.lines.map((l) => ({
        description: l.description,
        quantity: String(l.quantity),
        unit: l.unit,
        unitPrice: String(l.unitPrice),
        vatRate: l.vatRate,
        notes: l.notes ?? '',
      }));
    }
    if (initialData.rfq.lines.length > 0) {
      return initialData.rfq.lines.map((l) => ({
        description: l.description,
        quantity: l.quantity != null ? String(l.quantity) : '',
        unit: l.unit ?? 'τμχ',
        unitPrice: '',
        vatRate: 24,
        notes: '',
      }));
    }
    return [{ description: '', quantity: '', unit: 'τμχ', unitPrice: '', vatRate: 24, notes: '' }];
  }, [existingQuote, initialData.rfq.lines]);

  const onSubmit = async (formData: FormData) => {
    setPhase('submitting');
    setErrorKey(null);
    setErrorReason(null);
    try {
      const res = await fetch(`/api/vendor/quote/${encodeURIComponent(token)}`, {
        method: 'POST',
        body: formData,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        setErrorKey('errors.submitFailed');
        setErrorReason(json?.error ?? `HTTP_${res.status}`);
        setPhase('editing');
        return;
      }
      setSubmittedAt(json.data?.editWindowExpiresAt ?? null);
      setPhase('submitted');
    } catch (err) {
      setErrorKey('errors.submitFailed');
      setErrorReason(err instanceof Error ? err.message : 'unknown');
      setPhase('editing');
    }
  };

  const onDecline = async (reason: string | null) => {
    setPhase('declining');
    setErrorKey(null);
    try {
      const res = await fetch(`/api/vendor/quote/${encodeURIComponent(token)}/decline`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        setErrorKey('errors.submitFailed');
        setPhase('editing');
        return;
      }
      setPhase('declined');
    } catch {
      setErrorKey('errors.submitFailed');
      setPhase('editing');
    }
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">{t('vendor-portal:page.subtitle')}</p>
            <h1 className="text-base font-semibold text-slate-900">{t('vendor-portal:page.title')}</h1>
          </div>
          <button
            type="button"
            onClick={switchLanguage}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            aria-label="Switch language"
          >
            {t('vendor-portal:page.languageToggle')}
          </button>
        </div>
        <div className="border-t border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
          {t('vendor-portal:security.warning')}
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-6">
        {phase === 'declined' ? (
          <DeclinedState locale={locale} />
        ) : phase === 'submitted' ? (
          <SuccessState
            editWindowExpiresAt={submittedAt}
            locale={locale}
            onEditAgain={() => setPhase('editing')}
          />
        ) : (
          <VendorPortalForm
            initialData={initialData}
            initialLines={initialLines}
            existingQuote={existingQuote}
            phase={phase === 'submitting' ? 'submitting' : 'editing'}
            errorKey={errorKey}
            errorReason={errorReason}
            formattedExpiresAt={formattedExpiresAt}
            onSubmit={onSubmit}
            onDeclineRequest={() => setPhase('declining')}
          />
        )}
      </div>

      {phase === 'declining' && (
        <DeclineDialog
          onConfirm={onDecline}
          onCancel={() => setPhase('editing')}
        />
      )}
    </main>
  );
}

function DeclinedState({ locale }: { locale: 'el' | 'en' }) {
  const { t } = useTranslation(['vendor-portal']);
  const _ = locale;
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-700">
        ✓
      </div>
      <h2 className="text-lg font-semibold text-slate-900">{t('vendor-portal:decline.doneTitle')}</h2>
      <p className="mt-2 text-sm text-slate-600">{t('vendor-portal:decline.doneBody')}</p>
    </section>
  );
}
