'use client';

/**
 * @fileoverview **Η διαφορά που επιβεβαιώνει ο άνθρωπος πριν από τη δημοσίευση** (ADR-923 §5.11 «3δ» Τμήμα 1).
 * @related publish-flow.ts (`visibleChanges` — σειρά και όριο) · subapps/catalog/pricing/diff-price-versions.ts
 * @module components/catalog/pricing/PublishDiffList
 *
 * 🔑 **Μεταβολή ανά μονάδα** (από τον διακομιστή, ακριβής BigInt): 84 € «ανά 100» → 0,90 € «ανά 1» είναι +7,14%, όχι −98,9%.
 *    Η τιμή φαίνεται με την ποσότητα τιμής της («12,50 € / 100 τεμ.»), ώστε ο άνθρωπος να βλέπει **γιατί** είναι +7%.
 * 🔑 Φραγμένη γραμμή = **λέξη** («Πάνω από το όριο» / «Από ή προς μηδέν») + εικονίδιο, όχι μόνο κόκκινο (CHECK 3.41).
 * 🔑 Κωδικοί SKU από το `expand` της προεπισκόπησης — ποτέ εσωτερικά id· παραλλαγή που δεν ζει πια το λέει.
 */

import React from 'react';
import { AlertTriangle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { useUomLabel } from '@/hooks/useUomLabel';
import { formatMinor } from '@/lib/money/money';
import { formatPercentage } from '@/lib/intl-formatting';
import { BP_PER_WHOLE } from '@/lib/pricing/discount-rule';
import { priceLineSideChanges, type PriceLineChange } from '@/subapps/catalog/pricing/diff-price-versions';
import type { PriceListLineDefinition } from '@/subapps/catalog/types/price-list';
import type { PricePublicationPreview } from '@/subapps/catalog/types/price-list-requests';
import type { DiscountGroupWire } from '@/subapps/catalog/types/pricing-views';
import { useCatalogText } from '../shared/catalog-ui-hooks';
import { subjectCodeOf } from './price-line-rows';
import { CHANGE_KIND_ICONS, CHANGE_KIND_KEYS } from './pricing-labels';
import { changeCounts, visibleChanges } from './publish-flow';

function usePriceText() {
  const uom = useUomLabel();
  return (line: PriceListLineDefinition | null): string =>
    line === null ? '—' : `${formatMinor(line.netPrice)} / ${line.priceQuantity} ${uom(line.unitCode)}`;
}

/** Ό,τι άλλαξε εκτός τιμής· ποτέ ωμό id ομάδας. */
function SideChanges({ change, discountGroups }: { readonly change: PriceLineChange; readonly discountGroups: readonly DiscountGroupWire[] }) {
  const { t, text } = useCatalogText();
  const groupName = (groupId: string | null | undefined): string => {
    if (groupId === null || groupId === undefined) return t('pricing.publish.noGroup');
    const group = discountGroups.find((candidate) => candidate.id === groupId);
    return group ? text(group.labels, group.code) : t('pricing.publish.unknownGroup');
  };
  return priceLineSideChanges(change).map((side) => (
    <span key={side} className="col-span-2 text-muted-foreground">
      {side === 'breakdown'
        ? t('pricing.publish.breakdownChanged')
        : t('pricing.publish.discountGroupChange', { before: groupName(change.before?.discountGroupId), after: groupName(change.after?.discountGroupId) })}
    </span>
  ));
}

interface ChangeRowProps {
  readonly change: PriceLineChange;
  readonly skuIdentifiers: PricePublicationPreview['skuIdentifiers'];
  readonly discountGroups: readonly DiscountGroupWire[];
}

function ChangeRow({ change, skuIdentifiers, discountGroups }: ChangeRowProps) {
  const { t } = useCatalogText();
  const priceText = usePriceText();
  const subject = (change.after ?? change.before)?.subject;
  const code = subject ? subjectCodeOf(subject, skuIdentifiers) : null;
  const KindIcon = CHANGE_KIND_ICONS[change.kind];
  const delta = change.unitPriceChangeBp === null ? null : formatPercentage((change.unitPriceChangeBp / BP_PER_WHOLE) * 100, { maximumFractionDigits: 2, signDisplay: 'exceptZero' });
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-b py-2 text-sm last:border-b-0">
      <span className="flex min-w-0 items-center gap-2">
        <Badge variant="outline" className="gap-1"><KindIcon className="h-3 w-3" aria-hidden />{t(CHANGE_KIND_KEYS[change.kind])}</Badge>
        <span className="truncate font-mono">{code ?? t('pricing.publish.unknownSku')}</span>
      </span>
      {change.exceedsFence ? (
        <Badge variant="destructive" className="gap-1">
          <AlertTriangle className="h-3 w-3" aria-hidden />{t(change.unitPriceChangeBp === null ? 'pricing.publish.fromOrToZero' : 'pricing.publish.overFence')}
        </Badge>
      ) : <span />}
      <span className="text-muted-foreground">{`${priceText(change.before)} → ${priceText(change.after)}`}</span>
      <span className="text-right font-medium tabular-nums">{delta ?? ''}</span>
      <SideChanges change={change} discountGroups={discountGroups} />
    </li>
  );
}

export function PublishDiffList({ preview, discountGroups }: { readonly preview: PricePublicationPreview; readonly discountGroups: readonly DiscountGroupWire[] }) {
  const { t } = useCatalogText();
  const counts = changeCounts(preview.diff.changes);
  const { shown, hidden } = visibleChanges(preview.diff.changes);
  return (
    <section className="flex flex-col gap-2" aria-labelledby="publish-diff-title">
      <h3 id="publish-diff-title" className="m-0 text-sm font-semibold">{t('pricing.publish.diffTitle')}</h3>
      <p className="m-0 text-sm text-muted-foreground">
        {t('pricing.publish.summary', { added: counts.added, removed: counts.removed, changed: counts.changed, unchanged: preview.diff.unchanged })}
      </p>
      {shown.length === 0 ? (
        <p className="m-0 text-sm">{t('pricing.publish.noChanges')}</p>
      ) : (
        <ul className="m-0 max-h-80 list-none overflow-y-auto rounded-md border px-3 py-0">
          {shown.map((change) => <ChangeRow key={change.subjectKey} change={change} skuIdentifiers={preview.skuIdentifiers} discountGroups={discountGroups} />)}
        </ul>
      )}
      {hidden > 0 ? <p className="m-0 text-xs text-muted-foreground">{t('pricing.publish.hidden', { count: hidden })}</p> : null}
    </section>
  );
}
