'use client';

/**
 * @fileoverview **Η τιμή για έναν θεατή** — τελικό ποσό, λίστα + έκδοση, καταρράκτης, ίχνος (ADR-923 §5.11 «3δ» Τμήμα 3).
 *   Ανάλυση = μία κάρτα· σύγκριση κοινών = περισσότερες, δίπλα-δίπλα.
 * @related DiscountExample.tsx (`Waterfall`: η ΜΙΑ απόδοση καταρράκτη) · PriceTrace.tsx · price-analysis.ts
 * @module components/catalog/pricing/PriceQuoteCard
 *
 * 🔑 **Κανένας υπολογισμός τιμής στον πελάτη** (απόφαση Ζ): τελικό ποσό **και** ενδιάμεσα έρχονται από τον διακομιστή.
 * 🔑 Κάθε περίπτωση «δεν βγήκε τιμή» λέγεται με το **όνομά** της — ποτέ κενό, ποτέ «0,00 €».
 */

import React from 'react';
import { Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useUomLabel } from '@/hooks/useUomLabel';
import { formatMinor } from '@/lib/money/money';
import type { PriceAudience, PricingViewer } from '@/subapps/catalog/types/price-list';
import type { PriceQuoteResult } from '@/subapps/catalog/types/price-list-requests';
import type { CustomerGroupWire } from '@/subapps/catalog/types/pricing-views';
import { useCatalogText } from '../shared/catalog-ui-hooks';
import { AudienceField } from './AudienceField';
import { Waterfall } from './DiscountExample';
import type { AnalysisCell, AnalysisViewer } from './price-analysis';
import { PriceTrace } from './PriceTrace';
import { PRICE_OUTCOME_KEYS } from './pricing-labels';
import type { AnalysisNames } from './use-price-analysis-names';

const groupOfViewer = (viewer: PricingViewer): string | null => (viewer.kind === 'signedIn' ? viewer.customerGroupId : null);

function PricedBody({ result, saving, names }: {
  readonly result: Extract<PriceQuoteResult, { kind: 'priced' }>;
  readonly saving: number | null;
  readonly names: AnalysisNames;
}) {
  const { t } = useCatalogText();
  const uomLabel = useUomLabel();
  const { quote, cascade, viewer, listTrace } = result;
  const groupId = groupOfViewer(viewer);
  const unit = t('pricing.analysis.pricePer', { price: formatMinor(quote.netPrice), quantity: quote.priceQuantity, unit: uomLabel(quote.unitCode) });
  return (
    <>
      <p className="m-0 text-2xl font-semibold tabular-nums">{formatMinor(quote.netAmount)}</p>
      {saving !== null && saving !== 0 ? (
        <p className="m-0 text-xs text-muted-foreground">
          {t(saving > 0 ? 'pricing.analysis.saving' : 'pricing.analysis.surcharge', { amount: formatMinor(Math.abs(saving)) })}
        </p>
      ) : null}
      <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-0.5 text-xs">
        <dt className="text-muted-foreground">{t('pricing.analysis.list')}</dt><dd className="m-0 break-words">{names.list(quote.priceListId)}</dd>
        <dt className="text-muted-foreground">{t('pricing.analysis.version')}</dt><dd className="m-0">{names.version(quote.priceListVersionId)}</dd>
        <dt className="text-muted-foreground">{t('pricing.analysis.price')}</dt><dd className="m-0 tabular-nums">{unit}</dd>
        {groupId !== null ? <><dt className="text-muted-foreground">{t('pricing.audience.customerGroup')}</dt><dd className="m-0">{names.words.audience({ kind: 'customerGroup', customerGroupId: groupId })}</dd></> : null}
      </dl>
      {cascade.length > 0 ? (
        <Waterfall example={{ gross: quote.listAmount, steps: cascade, discount: quote.discountAmount, net: quote.netAmount }} />
      ) : <p className="m-0 text-xs text-muted-foreground">{t('pricing.analysis.noDiscount')}</p>}
      <PriceTrace listTrace={listTrace} conditionTrace={quote.trace} listName={names.list} conditionName={names.condition} />
    </>
  );
}

function UnpricedBody({ result, names }: { readonly result: Exclude<PriceQuoteResult, { kind: 'priced' }>; readonly names: AnalysisNames }) {
  const { t } = useCatalogText();
  const conditionTrace = result.kind === 'ambiguousDiscount' ? result.trace : [];
  return (
    <>
      <p className="m-0 text-sm font-medium" role="status">{t(PRICE_OUTCOME_KEYS[result.kind])}</p>
      <PriceTrace listTrace={result.listTrace} conditionTrace={conditionTrace} listName={names.list} conditionName={names.condition} />
    </>
  );
}

function CellBody({ cell, saving, names }: { readonly cell: AnalysisCell; readonly saving: number | null; readonly names: AnalysisNames }) {
  const { t } = useCatalogText();
  if (cell.state === 'incomplete') return <p className="m-0 text-sm text-muted-foreground">{t('pricing.analysis.pickViewer')}</p>;
  if (cell.state === 'loading') return <p className="m-0 text-sm text-muted-foreground" role="status">{t('pricing.analysis.loading')}</p>;
  if (cell.state === 'failed') return <p className="m-0 text-sm" role="alert">{t('pricing.analysis.failed')}</p>;
  if (cell.result.kind === 'priced') return <PricedBody result={cell.result} saving={saving} names={names} />;
  return <UnpricedBody result={cell.result} names={names} />;
}

interface PriceQuoteCardProps {
  readonly viewer: AnalysisViewer;
  readonly cell: AnalysisCell | null;
  readonly saving: number | null;
  readonly busy: boolean;
  readonly names: AnalysisNames;
  readonly customerGroups: readonly CustomerGroupWire[];
  readonly removable: boolean;
  readonly onChange: (key: string, audience: PriceAudience) => void;
  readonly onRemove: (key: string) => void;
}

export function PriceQuoteCard({ viewer, cell, saving, busy, names, customerGroups, removable, onChange, onRemove }: PriceQuoteCardProps) {
  const { t } = useCatalogText();
  return (
    <article className="flex min-w-0 flex-col gap-2 rounded-md border bg-card p-3 aria-busy:opacity-60" aria-busy={busy}>
      <header className="flex items-start gap-2">
        <section className="min-w-0 flex-1">
          <AudienceField value={viewer.audience} allowNone={false} customerGroups={customerGroups} disabled={false} issues={[]}
            onChange={(audience) => { if (audience) onChange(viewer.key, audience); }} />
        </section>
        {removable ? (
          <Button type="button" variant="ghost" size="icon" aria-label={t('pricing.analysis.removeViewer')} onClick={() => onRemove(viewer.key)}>
            <Trash2 className="h-4 w-4" aria-hidden />
          </Button>
        ) : null}
      </header>
      {cell ? <CellBody cell={cell} saving={saving} names={names} /> : null}
    </article>
  );
}
