'use client';

/**
 * VendorPortalClient — Mobile-first vendor quote submission UI.
 *
 * Public, no auth. The link (from the URL fragment, ADR-876 §5) travels ONLY as
 * `Authorization: Bearer` through `vendor-portal-api` — POST (submit / edit) and
 * `/decline`. Initial data (incl. an existing quote) comes from `VendorPortalGate`.
 *
 * @module app/(auth)/vendor/quote/VendorPortalClient
 * @enterprise ADR-327 §7 — Phase 3 Vendor Portal
 */

import React, { useState, useMemo } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { i18n } from 'i18next';
import { VendorPortalForm } from './VendorPortalForm';
import { DeclineDialog } from './DeclineDialog';
import { SuccessState } from './SuccessState';
import type { InitialData, QuoteLineDraft, QuoteSnapshot, VendorPortalActionError } from './types';
import type { VendorPortalIntent } from '@/subapps/procurement/services/vendor-portal-links';
import { vendorPortalAction, vendorPortalFetch } from './vendor-portal-api';

interface Props {
  token: string;
  initialData: InitialData;
  /** Η υπάρχουσα προσφορά (λειτουργία επεξεργασίας) — έρχεται μαζί με τα αρχικά δεδομένα. */
  initialQuote: QuoteSnapshot | null;
  /** Από τον σύνδεσμο του email (`#…&intent=decline`) — ανοίγει διάλογο, ΔΕΝ αρνείται (ADR-876 Ε3). */
  initialIntent: VendorPortalIntent | null;
  /** Μετά από επιτυχή υποβολή: ο Gate ξαναδιαβάζει προσφορά + `permits` από τον server. */
  onSubmitted: () => void;
}

type Phase = 'editing' | 'submitting' | 'submitted' | 'declined' | 'declining';

/**
 * Η αρχική φάση. ⚠️ Η πρόθεση άρνησης τιμάται **μόνο** σε πρόσκληση που δεν έχει υποβληθεί:
 * ένας παλιός σύνδεσμος «δεν ενδιαφέρομαι» δεν επιτρέπεται να ανοίξει διάλογο πάνω σε
 * προσφορά που ο προμηθευτής ήδη έστειλε.
 */
function initialPhase(invite: InitialData['invite'], intent: VendorPortalIntent | null): Phase {
  if (!invite.permits.submit) return 'submitted';
  return intent === 'decline' && invite.permits.decline ? 'declining' : 'editing';
}

export function VendorPortalClient({ token, initialData, initialQuote, initialIntent, onSubmitted }: Props) {
  const { t, i18n: instance } = useTranslation(['vendor-portal']);
  const [locale, setLocale] = useState<'el' | 'en'>(
    instance.language === 'en' ? 'en' : 'el',
  );
  const [phase, setPhase] = useState<Phase>(() => initialPhase(initialData.invite, initialIntent));
  const [actionError, setActionError] = useState<VendorPortalActionError | null>(null);
  const [errorReason, setErrorReason] = useState<string | null>(null);
  const existingQuote = initialQuote;
  const [submittedAt, setSubmittedAt] = useState<string | null>(
    initialData.invite.editWindowExpiresAt ?? null,
  );

  const formattedExpiresAt = useMemo(
    () => new Date(initialData.invite.expiresAt).toLocaleString(locale),
    [initialData.invite.expiresAt, locale],
  );

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
    setActionError(null);
    setErrorReason(null);
    try {
      const res = await vendorPortalFetch(token, { method: 'POST', body: formData });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        setActionError('submitFailed');
        setErrorReason(json?.error ?? `HTTP_${res.status}`);
        setPhase('editing');
        return;
      }
      setSubmittedAt(json.data?.editWindowExpiresAt ?? null);
      setPhase('submitted');
      onSubmitted();
    } catch (err) {
      setActionError('submitFailed');
      setErrorReason(err instanceof Error ? err.message : 'unknown');
      setPhase('editing');
    }
  };

  const onDecline = async (reason: string | null) => {
    setPhase('declining');
    setActionError(null);
    try {
      const res = await vendorPortalAction(token, '/decline', { reason });
      if (!res.ok) {
        setActionError('submitFailed');
        setPhase('editing');
        return;
      }
      setPhase('declined');
    } catch {
      setActionError('submitFailed');
      setPhase('editing');
    }
  };

  return (
    // ADR-876 — `<section>`, ΟΧΙ `<main className="min-h-screen">`: στο `(auth)` το `<main>` και το ύψος
    // οθόνης τα κατέχει το layout (`ShellSurface`). `self-start`: η πύλη είναι μακριά φόρμα, όχι
    // κεντραρισμένη κάρτα — ξεκινά από πάνω.
    <section className="w-full self-start bg-muted">
      <header className="sticky top-0 z-10 border-b border-border bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('vendor-portal:page.subtitle')}</p>
            <h1 className="text-base font-semibold text-foreground">{t('vendor-portal:page.title')}</h1>
          </div>
          <button
            type="button"
            onClick={switchLanguage}
            className="rounded-md border border-border bg-white px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
            aria-label="Switch language"
          >
            {t('vendor-portal:page.languageToggle')}
          </button>
        </div>
        <div className="border-t border-[hsl(var(--text-warning))]/60 bg-[hsl(var(--bg-warning))]/40 px-4 py-2 text-xs text-foreground">
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
            onEditAgain={initialData.invite.permits.submit ? () => setPhase('editing') : null}
          />
        ) : (
          <VendorPortalForm
            initialData={initialData}
            initialLines={initialLines}
            existingQuote={existingQuote}
            phase={phase === 'submitting' ? 'submitting' : 'editing'}
            actionError={actionError}
            errorReason={errorReason}
            formattedExpiresAt={formattedExpiresAt}
            onSubmit={onSubmit}
            onDeclineRequest={initialData.invite.permits.decline ? () => setPhase('declining') : null}
          />
        )}
      </div>

      {phase === 'declining' && (
        <DeclineDialog
          onConfirm={onDecline}
          onCancel={() => setPhase('editing')}
        />
      )}
    </section>
  );
}

function DeclinedState({ locale }: { locale: 'el' | 'en' }) {
  const { t } = useTranslation(['vendor-portal']);
  const _ = locale;
  return (
    <section className="rounded-lg border border-border bg-white p-8 text-center shadow-sm">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-foreground">
        ✓
      </div>
      <h2 className="text-lg font-semibold text-foreground">{t('vendor-portal:decline.doneTitle')}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{t('vendor-portal:decline.doneBody')}</p>
    </section>
  );
}
