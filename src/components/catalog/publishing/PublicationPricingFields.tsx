'use client';

/**
 * @fileoverview **Οι τιμές της έκδοσης** — χωρίς τιμές (τεχνικός κατάλογος) ή με τιμές: τιμοκατάλογος + **δημοσιευμένη**
 *   έκδοση + κοινό (ADR-923 §5.6.1 · §12).
 * @related pricing/AudienceField.tsx (ΕΝΑ κοινό, ίδια φόρμα με τους τιμοκαταλόγους) · hooks/catalog/usePriceListViews.ts
 * @module components/catalog/publishing/PublicationPricingFields
 *
 * 🔑 **Εξατομικευμένος κατάλογος = η ίδια συνταγή με άλλο κοινό**: το κοινό είναι πεδίο, όχι δεύτερο σύστημα. Οι τιμές
 *    λύνονται **μόνο** στον διακομιστή· εδώ διαλέγουμε μόνο ποια δημοσιευμένη έκδοση και για ποιον.
 * 🔑 Προσφέρονται **μόνο δημοσιευμένες** εκδόσεις λίστας πώλησης (η χρονογραμμή): πρόχειρη έκδοση δεν τυπώνεται ποτέ.
 * 🔑 Προεπιλογή = ό,τι ισχύει τώρα ({@link defaultVersionOf}), και κάθε επιλογή γράφει φάση και ημερομηνία: «Έκδοση 4» σκέτο
 *    δεν λέει ότι οι τιμές της αρχίζουν σε δύο εβδομάδες. Μελλοντική μένει επιλέξιμη, για κατάλογο που ετοιμάζεται από πριν.
 * ⚠️ Οι δύο όψεις τιμών φορτώνουν **μόνο** όταν ο άνθρωπος διαλέξει «με τιμές» — ο τεχνικός κατάλογος δεν ρωτά τιμές.
 */

import React, { useMemo } from 'react';

import { EnumSelect } from '@/components/ui/enum-select';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDiscountsView, usePriceListsView } from '@/hooks/catalog/usePriceListViews';
import { formatDate } from '@/lib/intl-formatting';
import type { PriceListVersionWire, PriceListWire } from '@/subapps/catalog/types/pricing-views';
import type { PublicationPricing } from '@/subapps/catalog/types/publication';
import { AudienceField } from '../pricing/AudienceField';
import { defaultVersionOf, summarizePriceList, type TimelineBand } from '../pricing/price-list-summary';
import { TIMELINE_PHASE_KEYS } from '../pricing/pricing-labels';
import { CatalogField } from '../shared/CatalogFormFields';
import { useCatalogText } from '../shared/catalog-ui-hooks';
import type { PublicationFieldsProps } from './publication-draft';

type PricingKind = PublicationPricing['kind'];
const PRICING_KINDS: readonly PricingKind[] = ['none', 'priced'];
const NO_LISTS: readonly PriceListWire[] = [];
const NO_VERSIONS: readonly PriceListVersionWire[] = [];

type Priced = Extract<PublicationPricing, { kind: 'priced' }>;

interface PricedProps extends Omit<PublicationFieldsProps, 'draft' | 'onChange'> {
  readonly pricing: Priced;
  readonly setPricing: (pricing: Priced) => void;
}

interface VersionSelectProps {
  readonly bands: readonly TimelineBand[];
  readonly value: string;
  readonly disabled: boolean;
  readonly onChange: (priceListVersionId: string) => void;
}

/** Οι εκδόσεις με τη νεότερη πρώτη, όπως η χρονογραμμή της σελίδας τιμοκαταλόγων. */
function PriceVersionSelect({ bands, value, disabled, onChange }: VersionSelectProps) {
  const { t } = useCatalogText();
  const optionOf = ({ entry, phase }: TimelineBand) => t('publishing.fields.priceVersionOption', {
    version: t('pricing.versions.number', { number: entry.version.number }),
    phase: t(TIMELINE_PHASE_KEYS[phase]),
    date: entry.window.fromMs === null ? '' : formatDate(new Date(entry.window.fromMs)),
  });
  return (
    <CatalogField label={t('publishing.fields.priceVersion')}>
      {({ id }) => (
        <Select value={bands.some((band) => band.entry.version.id === value) ? value : undefined} disabled={disabled || bands.length === 0} onValueChange={onChange}>
          <SelectTrigger id={id}><SelectValue /></SelectTrigger>
          <SelectContent>
            {[...bands].reverse().map((band) => <SelectItem key={band.entry.version.id} value={band.entry.version.id}>{optionOf(band)}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
    </CatalogField>
  );
}

function PricedFields({ pricing, setPricing, issues, disabled }: PricedProps) {
  const { t, text } = useCatalogText();
  const lists = usePriceListsView().current;
  const groups = useDiscountsView().current;
  const view = lists.state === 'ready' ? lists.view : null;
  const sales = useMemo(() => (view?.lists ?? NO_LISTS).filter((list) => list.kind === 'sales'), [view]);
  const summaryOf = (priceListId: string) => summarizePriceList(priceListId, view?.versions ?? NO_VERSIONS, view ? Date.parse(view.asOf) : 0);
  const pickList = (priceListId: string) =>
    setPricing({ ...pricing, priceListId, priceListVersionId: defaultVersionOf(summaryOf(priceListId))?.id ?? '' });
  return (
    <>
      <CatalogField label={t('publishing.fields.priceList')}>
        {({ id }) => (
          <Select value={sales.some((list) => list.id === pricing.priceListId) ? pricing.priceListId : undefined} disabled={disabled} onValueChange={pickList}>
            <SelectTrigger id={id}><SelectValue /></SelectTrigger>
            <SelectContent>{sales.map((list) => <SelectItem key={list.id} value={list.id}>{text(list.labels, list.code)}</SelectItem>)}</SelectContent>
          </Select>
        )}
      </CatalogField>
      <PriceVersionSelect bands={summaryOf(pricing.priceListId).bands} value={pricing.priceListVersionId} disabled={disabled}
        onChange={(priceListVersionId) => setPricing({ ...pricing, priceListVersionId })} />
      <AudienceField value={pricing.audience} allowNone={false} disabled={disabled} issues={issues}
        customerGroups={groups.state === 'ready' ? groups.view.customerGroups : []}
        onChange={(audience) => setPricing({ ...pricing, audience: audience ?? { kind: 'anonymous' } })} />
    </>
  );
}

export function PublicationPricingFields({ draft, onChange, issues, disabled }: PublicationFieldsProps) {
  const { t } = useCatalogText();
  const { pricing } = draft;
  const chooseKind = (kind: PricingKind) => {
    if (kind === pricing.kind) return;
    onChange({ ...draft, pricing: kind === 'none' ? { kind } : { kind, priceListId: '', priceListVersionId: '', audience: { kind: 'anonymous' } } });
  };
  return (
    <section className="flex min-w-0 flex-col gap-3">
      <CatalogField label={t('publishing.fields.pricing')}>
        {({ id }) => (
          <EnumSelect id={id} value={pricing.kind} values={PRICING_KINDS} disabled={disabled}
            getLabel={(kind) => t(`publishing.pricing.${kind}`)} onValueChange={chooseKind} />
        )}
      </CatalogField>
      {pricing.kind === 'priced' ? (
        <PricedFields pricing={pricing} issues={issues} disabled={disabled}
          setPricing={(next) => onChange({ ...draft, pricing: next })} />
      ) : null}
    </section>
  );
}
