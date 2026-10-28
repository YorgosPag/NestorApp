'use client';

/**
 * VendorPortalForm — line items, terms, attachments, submit/decline buttons.
 * Pure form component — phase + submission lifecycle owned by parent client.
 *
 * @module app/(auth)/vendor/quote/VendorPortalForm
 * @enterprise ADR-327 §7
 */

import React, { useState, useRef } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  VENDOR_QUOTE_ALLOWED_MIME as ALLOWED_MIME,
  VENDOR_QUOTE_MAX_FILE_BYTES as MAX_FILE_BYTES,
  VENDOR_QUOTE_MAX_IMAGES as MAX_IMAGES,
  VENDOR_QUOTE_MAX_PDFS as MAX_PDFS,
} from '@/subapps/procurement/config/vendor-quote-attachments';
import type {
  InitialData,
  QuoteSnapshot,
  VendorPortalActionError,
  VendorQuoteDraft,
} from './types';
import { toSubmissionPayload, validateDraft, type DraftValidationError } from './vendor-quote-draft';
import { useVendorQuoteDraft } from './useVendorQuoteDraft';
import { VendorPortalAnswers } from './VendorPortalAnswers';
import { VendorPortalAdditionalLines } from './VendorPortalAdditionalLines';

interface Props {
  initialData: InitialData;
  /** ADR-327 §8.5 — μία απάντηση ανά γραμμή RFQ + εναλλακτικές + πρόσθετες (`initialVendorDraft`). */
  initialDraft: VendorQuoteDraft;
  existingQuote: QuoteSnapshot | null;
  phase: 'editing' | 'submitting';
  actionError: VendorPortalActionError | null;
  errorReason: string | null;
  formattedExpiresAt: string;
  onSubmit: (formData: FormData) => Promise<void>;
  /** `null` ⇒ η άρνηση δεν επιτρέπεται (π.χ. υποβεβλημένη προσφορά) — κανένα κουμπί (ADR-876 §5 Σ16). */
  onDeclineRequest: (() => void) | null;
}

export function VendorPortalForm({
  initialData,
  initialDraft,
  existingQuote,
  phase,
  actionError,
  errorReason,
  formattedExpiresAt,
  onSubmit,
  onDeclineRequest,
}: Props) {
  const { t } = useTranslation(['vendor-portal']);
  // ADR-877 §6 — κλειστό σύνολο ⇒ ΣΤΑΤΙΚΗ `t()` ανά μέλος ⇒ το route slice ξέρει τα κλειδιά του.
  const actionErrorText: Readonly<Record<VendorPortalActionError, string>> = {
    submitFailed: t('vendor-portal:errors.submitFailed'),
  };
  const validationText: Readonly<Record<DraftValidationError, string>> = {
    validationLines: t('vendor-portal:errors.validationLines'),
    validationAnswers: t('vendor-portal:errors.validationAnswers'),
    validationAlternate: t('vendor-portal:errors.validationAlternate'),
  };
  const { draft, actions, totals } = useVendorQuoteDraft(initialDraft);
  const rfqLines = initialData.rfq.lines;
  const [paymentTerms, setPaymentTerms] = useState(existingQuote?.paymentTerms ?? '');
  const [deliveryTerms, setDeliveryTerms] = useState(existingQuote?.deliveryTerms ?? '');
  const [warranty, setWarranty] = useState(existingQuote?.warranty ?? '');
  const [notes, setNotes] = useState(existingQuote?.notes ?? '');
  const [validUntil, setValidUntil] = useState(
    existingQuote?.validUntil ? existingQuote.validUntil.slice(0, 10) : '',
  );
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<DraftValidationError | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const onFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    const incoming = Array.from(e.target.files ?? []);
    let images = files.filter((f) => f.type !== 'application/pdf').length;
    let pdfs = files.filter((f) => f.type === 'application/pdf').length;
    const accepted: File[] = [];
    for (const f of incoming) {
      if (!ALLOWED_MIME.has(f.type)) {
        setFileError(t('vendor-portal:attachments.unsupportedType', { name: f.name }));
        continue;
      }
      if (f.size > MAX_FILE_BYTES) {
        setFileError(t('vendor-portal:attachments.fileTooLarge', { name: f.name }));
        continue;
      }
      const isPdf = f.type === 'application/pdf';
      if (isPdf && pdfs >= MAX_PDFS) {
        setFileError(t('vendor-portal:attachments.maxPdfReached'));
        continue;
      }
      if (!isPdf && images >= MAX_IMAGES) {
        setFileError(t('vendor-portal:attachments.maxImagesReached'));
        continue;
      }
      accepted.push(f);
      if (isPdf) pdfs++;
      else images++;
    }
    if (accepted.length) setFiles((prev) => [...prev, ...accepted]);
    e.target.value = '';
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setValidationError(null);

    const invalid = validateDraft(draft);
    if (invalid) {
      setValidationError(invalid);
      return;
    }
    const payload = toSubmissionPayload(draft, rfqLines);

    const formData = new FormData();
    formData.set('lines', JSON.stringify(payload.lines));
    formData.set('alternates', JSON.stringify(payload.alternates));
    formData.set('scopeResponses', JSON.stringify(payload.scopeResponses));
    if (paymentTerms.trim()) formData.set('paymentTerms', paymentTerms.trim());
    if (deliveryTerms.trim()) formData.set('deliveryTerms', deliveryTerms.trim());
    if (warranty.trim()) formData.set('warranty', warranty.trim());
    if (notes.trim()) formData.set('notes', notes.trim());
    if (validUntil) formData.set('validUntil', validUntil);
    for (const f of files) formData.append('files', f);

    await onSubmit(formData);
  };

  const isSubmitting = phase === 'submitting';

  return (
    <form ref={formRef} onSubmit={submit} className="space-y-6">
      <RfqSummary initialData={initialData} formattedExpiresAt={formattedExpiresAt} />

      {rfqLines.length > 0 && (
        <Section title={t('vendor-portal:rfq.linesTitle')}>
          <VendorPortalAnswers
            rfqLines={rfqLines}
            answers={draft.answers}
            alternates={draft.alternates}
            actions={actions}
            responseLock={initialData.rfq.responseLock}
          />
        </Section>
      )}

      <Section title={rfqLines.length > 0 ? t('vendor-portal:form.additional.title') : t('vendor-portal:form.linesTitle')}>
        {rfqLines.length > 0 && (
          <p className="mb-2 text-xs text-muted-foreground">{t('vendor-portal:form.additional.hint')}</p>
        )}
        <VendorPortalAdditionalLines lines={draft.additional} actions={actions} keepAtLeastOne={rfqLines.length === 0} />
        <TotalsBox totals={totals} />
      </Section>

      <Section title={t('vendor-portal:form.termsTitle')}>
        <Field label={t('vendor-portal:form.paymentTerms')}>
          <input
            value={paymentTerms}
            onChange={(e) => setPaymentTerms(e.target.value)}
            placeholder={t('vendor-portal:form.paymentTermsHint')}
            className="w-full rounded-md border border-border px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t('vendor-portal:form.deliveryTerms')}>
          <input
            value={deliveryTerms}
            onChange={(e) => setDeliveryTerms(e.target.value)}
            placeholder={t('vendor-portal:form.deliveryTermsHint')}
            className="w-full rounded-md border border-border px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t('vendor-portal:form.warranty')}>
          <input
            value={warranty}
            onChange={(e) => setWarranty(e.target.value)}
            placeholder={t('vendor-portal:form.warrantyHint')}
            className="w-full rounded-md border border-border px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t('vendor-portal:form.validUntil')}>
          <input
            type="date"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
            className="w-full rounded-md border border-border px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t('vendor-portal:form.notes')}>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('vendor-portal:form.notesHint')}
            rows={3}
            className="w-full rounded-md border border-border px-3 py-2 text-sm"
          />
        </Field>
      </Section>

      <Section title={t('vendor-portal:attachments.title')}>
        <p className="mb-2 text-xs text-muted-foreground">{t('vendor-portal:attachments.hint')}</p>
        <input
          type="file"
          aria-label={t('vendor-portal:attachments.title')}
          accept={Array.from(ALLOWED_MIME).join(',')}
          onChange={onFilePick}
          multiple
          className="block w-full text-sm text-foreground"
        />
        {fileError && <p className="mt-2 text-sm text-destructive">{fileError}</p>}
        {files.length === 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">{t('vendor-portal:attachments.noFiles')}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {files.map((f, i) => (
              <li
                key={`${f.name}_${i}`}
                className="flex items-center justify-between rounded-md border border-border bg-muted px-3 py-2 text-xs text-foreground"
              >
                <span className="truncate">
                  <strong>{f.type === 'application/pdf' ? t('vendor-portal:attachments.pdf') : t('vendor-portal:attachments.image')}</strong>
                  {' · '}
                  {f.name}
                  {' · '}
                  {(f.size / 1024).toFixed(0)} KB
                </span>
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  {t('vendor-portal:attachments.remove')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {(validationError || actionError) && (
        <div className="rounded-md border border-[hsl(var(--text-error))]/60 bg-[hsl(var(--bg-error))]/40 px-4 py-3 text-sm text-destructive">
          {validationError ? validationText[validationError] : actionError && actionErrorText[actionError]}
          {errorReason && <span className="ml-2 text-xs text-destructive">[{errorReason}]</span>}
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 pt-4 sm:flex-row sm:justify-between">
        {onDeclineRequest ? (
          <button
            type="button"
            onClick={onDeclineRequest}
            disabled={isSubmitting}
            className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-accent disabled:opacity-50"
          >
            {t('vendor-portal:actions.decline')}
          </button>
        ) : null}
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 disabled:opacity-50 sm:ml-auto"
        >
          {isSubmitting ? t('vendor-portal:actions.submitting') : t('vendor-portal:actions.submit')}
        </button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-xs font-medium text-foreground">{label}</span>
      {children}
    </label>
  );
}

function RfqSummary({
  initialData,
  formattedExpiresAt,
}: {
  initialData: InitialData;
  formattedExpiresAt: string;
}) {
  const { t } = useTranslation(['vendor-portal']);
  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {t('vendor-portal:intro.rfqLabel')}
      </p>
      <h2 className="mt-1 text-base font-semibold text-foreground">{initialData.rfq.title}</h2>
      {initialData.rfq.description && (
        <p className="mt-2 text-sm text-foreground">{initialData.rfq.description}</p>
      )}
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        <dt>{t('vendor-portal:intro.deadlineLabel')}</dt>
        <dd className="text-right">
          {initialData.rfq.deadlineDate
            ? new Date(initialData.rfq.deadlineDate).toLocaleDateString()
            : t('vendor-portal:intro.noDeadline')}
        </dd>
        <dt>{t('vendor-portal:page.expiresOn', { date: formattedExpiresAt })}</dt>
        <dd></dd>
      </dl>
    </section>
  );
}

function TotalsBox({ totals }: { totals: { subtotal: number; vatAmount: number; total: number } }) {
  const { t } = useTranslation(['vendor-portal']);
  return (
    <dl className="mt-4 grid grid-cols-2 gap-1 rounded-md bg-muted px-4 py-3 text-sm">
      <dt className="text-muted-foreground">{t('vendor-portal:form.subtotal')}</dt>
      <dd className="text-right text-foreground">{totals.subtotal.toFixed(2)} €</dd>
      <dt className="text-muted-foreground">{t('vendor-portal:form.vatAmount')}</dt>
      <dd className="text-right text-foreground">{totals.vatAmount.toFixed(2)} €</dd>
      <dt className="font-semibold text-foreground">{t('vendor-portal:form.total')}</dt>
      <dd className="text-right font-semibold text-foreground">{totals.total.toFixed(2)} €</dd>
    </dl>
  );
}
