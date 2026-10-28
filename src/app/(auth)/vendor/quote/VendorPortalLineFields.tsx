'use client';

/**
 * Τα πεδία τιμολόγησης μιας γραμμής (ποσότητα · μονάδα · τιμή · ΦΠΑ · σύνολο) — ΕΝΑ component για απάντηση σε
 * γραμμή RFQ, εναλλακτική και πρόσθετη γραμμή (ADR-327 §8.5).
 *
 * §8.5 Β — `locked`: ποσότητα/μονάδα που όρισε ο αναθέτων (Procore «Unit & Quantity Lock») εμφανίζονται ως
 * **τιμή**, όχι ως απενεργοποιημένο πεδίο: δεν μοιάζουν με κάτι που «κάτι χάλασε». Την επιβολή την κάνει ο server
 * (`applyRfqLineAuthority`)· εδώ μόνο η παρουσίαση.
 *
 * @module app/(auth)/vendor/quote/VendorPortalLineFields
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCurrency } from '@/lib/intl-formatting';
import type { LockedFields } from '@/subapps/procurement/utils/rfq-response-lock';
import type { QuoteLineDraft } from './types';
import { draftLineTotal } from './vendor-quote-draft';
import { useVendorUomLabel, useVendorUomOptions } from './useVendorUomOptions';

const VAT_RATES: readonly QuoteLineDraft['vatRate'][] = [24, 13, 6, 0];

type PriceFields = Pick<QuoteLineDraft, 'quantity' | 'unit' | 'unitPrice' | 'vatRate'>;

interface Props {
  line: PriceFields;
  onChange: (patch: Partial<PriceFields>) => void;
  /** Μόνο στη βασική απάντηση γραμμής RFQ — ποτέ σε εναλλακτική ή πρόσθετη γραμμή. */
  locked?: LockedFields;
}

const INPUT = 'mt-1 w-full rounded-md border border-border px-3 py-2 text-sm';
const LOCKED = 'mt-1 flex w-full items-center rounded-md border border-dashed border-border bg-muted px-3 py-2 text-sm font-medium text-foreground';

export function VendorPortalLineFields({ line, onChange, locked }: Props) {
  const { t } = useTranslation(['vendor-portal']);
  const anyLocked = locked !== undefined && (locked.quantity !== null || locked.unit !== null);
  return (
    <fieldset className="grid grid-cols-2 gap-2 sm:grid-cols-12">
      <QuantityField value={line.quantity} locked={locked?.quantity ?? null} onChange={(quantity) => onChange({ quantity })} />
      <UnitField value={line.unit} locked={locked?.unit ?? null} onChange={(unit) => onChange({ unit })} />
      <label className="block sm:col-span-3">
        <span className="text-xs font-medium text-foreground">{t('vendor-portal:form.unitPrice')}</span>
        <input
          type="number" min="0" step="0.01" inputMode="decimal" required
          value={line.unitPrice}
          onChange={(e) => onChange({ unitPrice: e.target.value })}
          className={INPUT}
        />
      </label>
      <label className="block sm:col-span-3">
        <span className="text-xs font-medium text-foreground">{t('vendor-portal:form.vatRate')}</span>
        <select
          value={line.vatRate}
          onChange={(e) => onChange({ vatRate: Number(e.target.value) as QuoteLineDraft['vatRate'] })}
          className={INPUT}
        >
          {VAT_RATES.map((rate) => <option key={rate} value={rate}>{rate}%</option>)}
        </select>
      </label>
      {anyLocked && (
        <p className="col-span-2 text-xs text-muted-foreground sm:col-span-12">{t('vendor-portal:form.lock.hint')}</p>
      )}
      <p className="col-span-2 text-xs text-muted-foreground sm:col-span-12">
        {t('vendor-portal:form.lineTotal')}: <strong>{formatCurrency(draftLineTotal(line))}</strong>
      </p>
    </fieldset>
  );
}

function QuantityField({ value, locked, onChange }: {
  value: string;
  locked: number | null;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation(['vendor-portal']);
  const label = t('vendor-portal:form.quantity');
  if (locked !== null) return <LockedValue label={label} value={String(locked)} />;
  return (
    <label className="block sm:col-span-3">
      <span className="text-xs font-medium text-foreground">{label}</span>
      <input
        type="number" min="0" step="any" inputMode="decimal" required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={INPUT}
      />
    </label>
  );
}

function UnitField({ value, locked, onChange }: {
  value: string;
  locked: string | null;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation(['vendor-portal']);
  const uomLabel = useVendorUomLabel();
  const unitOptions = useVendorUomOptions(value);
  const label = t('vendor-portal:form.unit');
  if (locked !== null) return <LockedValue label={label} value={uomLabel(locked)} />;
  return (
    <label className="block sm:col-span-3">
      <span className="text-xs font-medium text-foreground">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={INPUT}>
        {unitOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

/** Τιμή που όρισε ο αναθέτων — εμφανίζεται ως τιμή, με το «γιατί» στο προσβάσιμο όνομα. */
function LockedValue({ label, value }: { label: string; value: string }) {
  const { t } = useTranslation(['vendor-portal']);
  return (
    <div className="sm:col-span-3">
      <span className="text-xs font-medium text-foreground">{label}</span>
      <output className={LOCKED} aria-label={`${label} — ${t('vendor-portal:form.lock.setByRequester')}`}>
        {value}
      </output>
    </div>
  );
}
