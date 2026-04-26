'use client';

/**
 * VendorPortalForm — line items, terms, attachments, submit/decline buttons.
 * Pure form component — phase + submission lifecycle owned by parent client.
 *
 * @module app/vendor/quote/[token]/VendorPortalForm
 * @enterprise ADR-327 §7
 */

import React, { useMemo, useState, useRef } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type {
  InitialData,
  QuoteLineDraft,
  QuoteSnapshot,
} from './types';

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_IMAGES = 5;
const MAX_PDFS = 1;
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
]);

interface Props {
  initialData: InitialData;
  initialLines: QuoteLineDraft[];
  existingQuote: QuoteSnapshot | null;
  phase: 'editing' | 'submitting';
  errorKey: string | null;
  errorReason: string | null;
  formattedExpiresAt: string;
  onSubmit: (formData: FormData) => Promise<void>;
  onDeclineRequest: () => void;
}

export function VendorPortalForm({
  initialData,
  initialLines,
  existingQuote,
  phase,
  errorKey,
  errorReason,
  formattedExpiresAt,
  onSubmit,
  onDeclineRequest,
}: Props) {
  const { t } = useTranslation(['vendor-portal']);
  const [lines, setLines] = useState<QuoteLineDraft[]>(initialLines);
  const [paymentTerms, setPaymentTerms] = useState(existingQuote?.paymentTerms ?? '');
  const [deliveryTerms, setDeliveryTerms] = useState(existingQuote?.deliveryTerms ?? '');
  const [warranty, setWarranty] = useState(existingQuote?.warranty ?? '');
  const [notes, setNotes] = useState(existingQuote?.notes ?? '');
  const [validUntil, setValidUntil] = useState(
    existingQuote?.validUntil ? existingQuote.validUntil.slice(0, 10) : '',
  );
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const totals = useMemo(() => computeTotals(lines), [lines]);

  const updateLine = (idx: number, patch: Partial<QuoteLineDraft>) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };
  const removeLine = (idx: number) => {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };
  const addLine = () => {
    setLines((prev) => [
      ...prev,
      { description: '', quantity: '', unit: 'τμχ', unitPrice: '', vatRate: 24, notes: '' },
    ]);
  };

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

    if (lines.length === 0) {
      setValidationError(t('vendor-portal:errors.validationLines'));
      return;
    }
    const cleanLines = lines
      .map((l) => ({
        description: l.description.trim(),
        quantity: Number(l.quantity),
        unit: l.unit.trim() || 'τμχ',
        unitPrice: Number(l.unitPrice),
        vatRate: l.vatRate,
        notes: l.notes.trim() || null,
      }))
      .filter(
        (l) =>
          l.description &&
          Number.isFinite(l.quantity) &&
          l.quantity > 0 &&
          Number.isFinite(l.unitPrice) &&
          l.unitPrice >= 0,
      );
    if (cleanLines.length === 0) {
      setValidationError(t('vendor-portal:errors.validationLines'));
      return;
    }

    const formData = new FormData();
    formData.set('lines', JSON.stringify(cleanLines));
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

      <Section title={t('vendor-portal:form.linesTitle')}>
        <ul className="space-y-3">
          {lines.map((line, idx) => (
            <LineRow
              key={idx}
              line={line}
              onChange={(patch) => updateLine(idx, patch)}
              onRemove={lines.length > 1 ? () => removeLine(idx) : null}
            />
          ))}
        </ul>
        <button
          type="button"
          onClick={addLine}
          className="mt-3 rounded-md border border-dashed border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          + {t('vendor-portal:form.addLine')}
        </button>
        <TotalsBox totals={totals} />
      </Section>

      <Section title={t('vendor-portal:form.termsTitle')}>
        <Field label={t('vendor-portal:form.paymentTerms')}>
          <input
            value={paymentTerms}
            onChange={(e) => setPaymentTerms(e.target.value)}
            placeholder={t('vendor-portal:form.paymentTermsHint')}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t('vendor-portal:form.deliveryTerms')}>
          <input
            value={deliveryTerms}
            onChange={(e) => setDeliveryTerms(e.target.value)}
            placeholder={t('vendor-portal:form.deliveryTermsHint')}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t('vendor-portal:form.warranty')}>
          <input
            value={warranty}
            onChange={(e) => setWarranty(e.target.value)}
            placeholder={t('vendor-portal:form.warrantyHint')}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t('vendor-portal:form.validUntil')}>
          <input
            type="date"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t('vendor-portal:form.notes')}>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('vendor-portal:form.notesHint')}
            rows={3}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </Field>
      </Section>

      <Section title={t('vendor-portal:attachments.title')}>
        <p className="mb-2 text-xs text-slate-500">{t('vendor-portal:attachments.hint')}</p>
        <input
          type="file"
          accept={Array.from(ALLOWED_MIME).join(',')}
          onChange={onFilePick}
          multiple
          className="block w-full text-sm text-slate-700"
        />
        {fileError && <p className="mt-2 text-sm text-red-600">{fileError}</p>}
        {files.length === 0 ? (
          <p className="mt-3 text-xs text-slate-400">{t('vendor-portal:attachments.noFiles')}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {files.map((f, i) => (
              <li
                key={`${f.name}_${i}`}
                className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700"
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
                  className="text-slate-500 hover:text-red-600"
                >
                  {t('vendor-portal:attachments.remove')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {(validationError || errorKey) && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {validationError ?? t(`vendor-portal:${errorKey}`)}
          {errorReason && <span className="ml-2 text-xs text-red-600">[{errorReason}]</span>}
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 pt-4 sm:flex-row sm:justify-between">
        <button
          type="button"
          onClick={onDeclineRequest}
          disabled={isSubmitting}
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {t('vendor-portal:actions.decline')}
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {isSubmitting ? t('vendor-portal:actions.submitting') : t('vendor-portal:actions.submit')}
        </button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-xs font-medium text-slate-700">{label}</span>
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
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-slate-500">
        {t('vendor-portal:intro.rfqLabel')}
      </p>
      <h2 className="mt-1 text-base font-semibold text-slate-900">{initialData.rfq.title}</h2>
      {initialData.rfq.description && (
        <p className="mt-2 text-sm text-slate-700">{initialData.rfq.description}</p>
      )}
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
        <dt>{t('vendor-portal:intro.deadlineLabel')}</dt>
        <dd className="text-right">
          {initialData.rfq.deadlineDate
            ? new Date(initialData.rfq.deadlineDate).toLocaleDateString()
            : t('vendor-portal:intro.noDeadline')}
        </dd>
        <dt>{t('vendor-portal:page.expiresOn', { date: formattedExpiresAt })}</dt>
        <dd></dd>
      </dl>
      {initialData.rfq.lines.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium text-slate-700">{t('vendor-portal:rfq.linesTitle')}</p>
          <ul className="mt-2 space-y-1 text-xs text-slate-600">
            {initialData.rfq.lines.map((l) => (
              <li key={l.id}>
                · {l.description}
                {l.quantity != null ? ` — ${l.quantity} ${l.unit ?? ''}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function LineRow({
  line,
  onChange,
  onRemove,
}: {
  line: QuoteLineDraft;
  onChange: (patch: Partial<QuoteLineDraft>) => void;
  onRemove: (() => void) | null;
}) {
  const { t } = useTranslation(['vendor-portal']);
  return (
    <li className="rounded-md border border-slate-200 p-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-12">
        <div className="sm:col-span-12">
          <label className="text-xs font-medium text-slate-700">{t('vendor-portal:form.description')}</label>
          <input
            value={line.description}
            onChange={(e) => onChange({ description: e.target.value })}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            required
          />
        </div>
        <div className="sm:col-span-3">
          <label className="text-xs font-medium text-slate-700">{t('vendor-portal:form.quantity')}</label>
          <input
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={line.quantity}
            onChange={(e) => onChange({ quantity: e.target.value })}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            required
          />
        </div>
        <div className="sm:col-span-3">
          <label className="text-xs font-medium text-slate-700">{t('vendor-portal:form.unit')}</label>
          <input
            value={line.unit}
            onChange={(e) => onChange({ unit: e.target.value })}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="sm:col-span-3">
          <label className="text-xs font-medium text-slate-700">{t('vendor-portal:form.unitPrice')}</label>
          <input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={line.unitPrice}
            onChange={(e) => onChange({ unitPrice: e.target.value })}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            required
          />
        </div>
        <div className="sm:col-span-3">
          <label className="text-xs font-medium text-slate-700">{t('vendor-portal:form.vatRate')}</label>
          <select
            value={line.vatRate}
            onChange={(e) => onChange({ vatRate: Number(e.target.value) as 0 | 6 | 13 | 24 })}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value={24}>24%</option>
            <option value={13}>13%</option>
            <option value={6}>6%</option>
            <option value={0}>0%</option>
          </select>
        </div>
        <div className="sm:col-span-12 flex items-center justify-between text-xs text-slate-600">
          <span>
            {t('vendor-portal:form.lineTotal')}: <strong>{computeLineTotal(line).toFixed(2)} €</strong>
          </span>
          {onRemove && (
            <button type="button" onClick={onRemove} className="text-red-600 hover:underline">
              {t('vendor-portal:form.removeLine')}
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

function TotalsBox({ totals }: { totals: { subtotal: number; vatAmount: number; total: number } }) {
  const { t } = useTranslation(['vendor-portal']);
  return (
    <dl className="mt-4 grid grid-cols-2 gap-1 rounded-md bg-slate-50 px-4 py-3 text-sm">
      <dt className="text-slate-600">{t('vendor-portal:form.subtotal')}</dt>
      <dd className="text-right text-slate-900">{totals.subtotal.toFixed(2)} €</dd>
      <dt className="text-slate-600">{t('vendor-portal:form.vatAmount')}</dt>
      <dd className="text-right text-slate-900">{totals.vatAmount.toFixed(2)} €</dd>
      <dt className="font-semibold text-slate-700">{t('vendor-portal:form.total')}</dt>
      <dd className="text-right font-semibold text-slate-900">{totals.total.toFixed(2)} €</dd>
    </dl>
  );
}

function computeLineTotal(l: QuoteLineDraft): number {
  const q = Number(l.quantity);
  const p = Number(l.unitPrice);
  if (!Number.isFinite(q) || !Number.isFinite(p)) return 0;
  return q * p;
}

function computeTotals(lines: QuoteLineDraft[]) {
  let subtotal = 0;
  let vatAmount = 0;
  for (const l of lines) {
    const lt = computeLineTotal(l);
    subtotal += lt;
    vatAmount += lt * (l.vatRate / 100);
  }
  return { subtotal, vatAmount, total: subtotal + vatAmount };
}
