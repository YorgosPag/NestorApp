'use client';

/**
 * @fileoverview ADR-915 §42 — **τα πεδία της προσφοράς**: ποσό · ΦΠΑ · ενδεικτική ή δεσμευτική · ισχύς · τι περιλαμβάνει,
 *   με ζωντανά καθαρό/ΦΠΑ/σύνολο. ΕΝΑ σύνολο πεδίων για τη σελίδα του επαγγελματία **και** την καταγραφή του γραφείου.
 * @related lib/document-validity/issuance-quote.ts (σύνολα · κανόνες) · lib/document-validity/issuance-request.ts (σχήμα)
 * @module components/document-registry/IssuanceQuoteFields
 *
 * 🔑 **Μία τιμή**: κανένα πεδίο «μετρητά», καμία δεύτερη τιμή — και η φόρμα το **λέει** (`quote.oneTruth`).
 * 🔑 Λεξιλόγιο στο `document-registry` (`issuance.quoteForm.*`): το φορτώνει ήδη και η σελίδα-σύνδεσμος, άρα καμία
 *    νέα αναμονή namespace σε καμία από τις δύο διαδρομές (ADR-744 §27).
 */

import React, { useId } from 'react';

import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { conveyanceToday } from '@/lib/conveyance/conveyance-calendar';
import { formatMinor } from '@/lib/money/money';
import {
  QUOTE_BASES,
  QUOTE_DELIVERY_BUSINESS_DAYS,
  QUOTE_SCOPE_ITEMS,
  quoteTotalsOf,
  requiresElectronicPayment,
  type QuoteScopeItem,
} from '@/lib/document-validity/issuance-quote';
import { GREEK_STANDARD_VAT_RATE, GREEK_VAT_RATE_PERCENTS } from '@/subapps/accounting/services/config/vat-rates';

import { ChoiceField } from './IssuanceChoiceField';
import { quoteTermsFromDraft, type QuoteDraft } from './issuance-quote-draft';
import { scopeText } from './issuance-quote-labels';

const VAT_OPTIONS = GREEK_VAT_RATE_PERCENTS.map(String);

function QuoteTotalsLine({ draft }: { readonly draft: QuoteDraft }): React.ReactElement | null {
  const { t } = useTranslation(['document-registry']);
  const terms = quoteTermsFromDraft({ ...draft, basis: draft.basis ?? 'firm' });
  if (terms === null) return null;
  const totals = quoteTotalsOf(terms);
  return (
    <section className="flex flex-col gap-1" aria-live="polite">
      <p className="m-0 text-sm text-foreground">
        {t('document-registry:issuance.quoteForm.totals', { net: formatMinor(totals.netMinor), vat: formatMinor(totals.vatMinor), total: formatMinor(totals.totalMinor) })}
      </p>
      {requiresElectronicPayment(totals) ? <p className="m-0 text-xs text-muted-foreground">{t('document-registry:issuance.quoteForm.electronicPayment')}</p> : null}
    </section>
  );
}

export interface IssuanceQuoteFieldsProps {
  readonly draft: QuoteDraft;
  readonly onChange: (next: QuoteDraft) => void;
  readonly disabled?: boolean;
}

export function IssuanceQuoteFields({ draft, onChange, disabled = false }: IssuanceQuoteFieldsProps): React.ReactElement {
  const { t } = useTranslation(['document-registry']);
  const amountId = useId();
  const validId = useId();
  const includedId = useId();
  const deliveryId = useId();
  const deliveryHintId = useId();
  const set = (patch: Partial<QuoteDraft>) => onChange({ ...draft, ...patch });
  const toggleScope = (item: QuoteScopeItem, on: boolean) =>
    set({ scope: QUOTE_SCOPE_ITEMS.filter((each) => (each === item ? on : draft.scope.includes(each))) });
  return (
    <fieldset className="m-0 flex flex-col gap-3 border-0 p-0" disabled={disabled}>
      <Label htmlFor={amountId} className="text-sm font-medium">{t('document-registry:issuance.quoteForm.amountLabel')}</Label>
      <Input id={amountId} inputMode="decimal" autoComplete="off" value={draft.amount} onChange={(event) => set({ amount: event.target.value })} />
      <ChoiceField
        legend={t('document-registry:issuance.quoteForm.vatLegend')} options={VAT_OPTIONS} value={String(draft.vatRatePercent)}
        onChange={(next) => set({ vatRatePercent: GREEK_VAT_RATE_PERCENTS.find((rate) => String(rate) === next) ?? GREEK_STANDARD_VAT_RATE })}
        labelOf={(option) => (option === '0' ? t('document-registry:issuance.quoteForm.vatNone') : t('document-registry:issuance.quoteForm.vatRate', { rate: option }))}
      />
      <Label htmlFor={includedId} className="flex items-center gap-2 text-sm font-normal">
        <Checkbox id={includedId} checked={draft.vatIncluded && draft.vatRatePercent !== 0} disabled={draft.vatRatePercent === 0} onCheckedChange={(checked) => set({ vatIncluded: checked === true })} />
        <span>{t('document-registry:issuance.quoteForm.vatIncluded')}</span>
      </Label>
      <ChoiceField
        legend={t('document-registry:issuance.quoteForm.basisLegend')} options={QUOTE_BASES} value={draft.basis} onChange={(basis) => set({ basis })}
        labelOf={(option) => (option === 'indicative' ? t('document-registry:issuance.quoteForm.basis.indicative') : t('document-registry:issuance.quoteForm.basis.firm'))}
      />
      <Label htmlFor={validId} className="text-sm font-medium">{t('document-registry:issuance.quoteForm.validUntilLabel')}</Label>
      <Input id={validId} type="date" value={draft.validUntil} min={conveyanceToday()} onChange={(event) => set({ validUntil: event.target.value })} />
      {/* §45 Φ2 — ο χρόνος είναι μέρος της προσφοράς: ο υπεύθυνος εγκρίνει πρόσωπο + τιμή + χρόνο μαζί. */}
      <Label htmlFor={deliveryId} className="text-sm font-medium">{t('document-registry:issuance.quoteForm.deliveryDaysLabel')}</Label>
      <Input
        id={deliveryId} inputMode="numeric" autoComplete="off" aria-describedby={deliveryHintId}
        min={QUOTE_DELIVERY_BUSINESS_DAYS.min} max={QUOTE_DELIVERY_BUSINESS_DAYS.max}
        value={draft.deliveryDays} onChange={(event) => set({ deliveryDays: event.target.value })}
      />
      <p id={deliveryHintId} className="m-0 text-xs text-muted-foreground">
        {t('document-registry:issuance.quoteForm.deliveryDaysHint', { min: String(QUOTE_DELIVERY_BUSINESS_DAYS.min), max: String(QUOTE_DELIVERY_BUSINESS_DAYS.max) })}
      </p>
      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="mb-1 text-sm font-medium text-foreground">{t('document-registry:issuance.quoteForm.scopeLegend')}</legend>
        {QUOTE_SCOPE_ITEMS.map((item) => (
          <Label key={item} className="flex items-center gap-2 text-sm font-normal">
            <Checkbox checked={draft.scope.includes(item)} onCheckedChange={(checked) => toggleScope(item, checked === true)} />
            <span>{scopeText(t, item)}</span>
          </Label>
        ))}
      </fieldset>
      <QuoteTotalsLine draft={draft} />
      <p className="m-0 text-xs text-muted-foreground">{t('document-registry:issuance.quoteForm.oneTruth')}</p>
    </fieldset>
  );
}

