'use client';

/**
 * @fileoverview **Οι τιμές της έκδοσης** — χωρίς τιμές (τεχνικός κατάλογος) ή με τιμές: τιμοκατάλογος + **δημοσιευμένη**
 *   έκδοση + κοινό (ADR-923 §5.6.1 · §12).
 * @related pricing/AudienceField.tsx (ΕΝΑ κοινό, ίδια φόρμα με τους τιμοκαταλόγους) · hooks/catalog/usePriceListViews.ts
 * @module components/catalog/publishing/PublicationPricingFields
 *
 * 🔑 **Εξατομικευμένος κατάλογος = η ίδια συνταγή με άλλο κοινό**: το κοινό είναι πεδίο, όχι δεύτερο σύστημα. Οι τιμές
 *    λύνονται **μόνο** στον διακομιστή· εδώ διαλέγουμε μόνο ποια δημοσιευμένη έκδοση και για ποιον.
 * 🔑 Προσφέρονται **μόνο δημοσιευμένες** εκδόσεις λίστας πώλησης (`isPublishedStatus`): πρόχειρη έκδοση δεν τυπώνεται ποτέ.
 * ⚠️ Οι δύο όψεις τιμών φορτώνουν **μόνο** όταν ο άνθρωπος διαλέξει «με τιμές» — ο τεχνικός κατάλογος δεν ρωτά τιμές.
 */

import React, { useMemo } from 'react';

import { EnumSelect } from '@/components/ui/enum-select';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDiscountsView, usePriceListsView } from '@/hooks/catalog/usePriceListViews';
import type { PriceListVersionWire, PriceListWire } from '@/subapps/catalog/types/pricing-views';
import type { PublicationPricing } from '@/subapps/catalog/types/publication';
import { isPublishedStatus } from '@/subapps/catalog/vocabulary/pricing';
import { AudienceField } from '../pricing/AudienceField';
import { CatalogField } from '../shared/CatalogFormFields';
import { useCatalogText } from '../shared/catalog-ui-hooks';
import type { PublicationFieldsProps } from './publication-draft';

type PricingKind = PublicationPricing['kind'];
const PRICING_KINDS: readonly PricingKind[] = ['none', 'priced'];
const NO_LISTS: readonly PriceListWire[] = [];
const NO_VERSIONS: readonly PriceListVersionWire[] = [];

/** Η πιο πρόσφατη δημοσιευμένη έκδοση μιας λίστας — η εύλογη προεπιλογή όταν διαλέγεται λίστα. */
function latestPublished(versions: readonly PriceListVersionWire[], priceListId: string): PriceListVersionWire | null {
  const own = versions.filter((version) => version.priceListId === priceListId && isPublishedStatus(version.status));
  return own.reduce<PriceListVersionWire | null>((best, version) => (best === null || version.number > best.number ? version : best), null);
}

type Priced = Extract<PublicationPricing, { kind: 'priced' }>;

interface PricedProps extends Omit<PublicationFieldsProps, 'draft' | 'onChange'> {
  readonly pricing: Priced;
  readonly setPricing: (pricing: Priced) => void;
}

function PricedFields({ pricing, setPricing, issues, disabled }: PricedProps) {
  const { t, text } = useCatalogText();
  const lists = usePriceListsView().current;
  const groups = useDiscountsView().current;
  const view = lists.state === 'ready' ? lists.view : null;
  const sales = useMemo(() => (view?.lists ?? NO_LISTS).filter((list) => list.kind === 'sales'), [view]);
  const published = useMemo(
    () => (view?.versions ?? NO_VERSIONS).filter((version) => version.priceListId === pricing.priceListId && isPublishedStatus(version.status)),
    [view, pricing.priceListId],
  );
  const pickList = (priceListId: string) =>
    setPricing({ ...pricing, priceListId, priceListVersionId: latestPublished(view?.versions ?? NO_VERSIONS, priceListId)?.id ?? '' });
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
      <CatalogField label={t('publishing.fields.priceVersion')}>
        {({ id }) => (
          <Select value={published.some((version) => version.id === pricing.priceListVersionId) ? pricing.priceListVersionId : undefined}
            disabled={disabled || published.length === 0} onValueChange={(priceListVersionId) => setPricing({ ...pricing, priceListVersionId })}>
            <SelectTrigger id={id}><SelectValue /></SelectTrigger>
            <SelectContent>
              {published.map((version) => <SelectItem key={version.id} value={version.id}>{t('pricing.versions.number', { number: version.number })}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </CatalogField>
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
