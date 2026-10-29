'use client';

/**
 * @fileoverview **Η λίστα τιμοκαταλόγων** — ομαδοποιημένη σε Πώλησης / Κόστους, με την εικόνα κάθε λίστας «τώρα»
 *   (ADR-923 §5.11 «3δ» Τμήμα 1).
 * @related price-list-summary.ts (τρέχουσα · μελλοντικές · πρόχειρες — από τη ΜΙΑ χρονογραμμή) · shared/CatalogList.tsx
 * @module components/catalog/pricing/PriceListList
 *
 * 🔑 Τα σήματα λένε **λέξη**, όχι μόνο χρώμα (CHECK 3.41): «Ισχύει από …» · «Χωρίς δημοσίευση» · «Πρόχειρη» ·
 *    «Μελλοντική» — ο αγοραστής βλέπει με μια ματιά ποια λίστα έχει αλλαγή σε αναμονή.
 */

import React from 'react';
import { Receipt, Wallet } from 'lucide-react';

import { formatDate } from '@/lib/intl-formatting';
import type { PriceListWire, PriceListVersionWire } from '@/subapps/catalog/types/pricing-views';
import { PRICE_LIST_KINDS, type PriceListKind } from '@/subapps/catalog/vocabulary/pricing';
import { CatalogListItem, CatalogListSection, type CatalogListBadge } from '../shared/CatalogList';
import { useCatalogText } from '../shared/catalog-ui-hooks';
import { summarizePriceList } from './price-list-summary';
import { AUDIENCE_KIND_KEYS } from './pricing-labels';

const SECTION_KEYS: Readonly<Record<PriceListKind, string>> = {
  sales: 'pricing.list.salesSection',
  cost: 'pricing.list.costSection',
};

const SECTION_ICONS: Readonly<Record<PriceListKind, typeof Receipt>> = {
  sales: Receipt,
  cost: Wallet,
};

interface PriceListListProps {
  readonly lists: readonly PriceListWire[];
  readonly versions: readonly PriceListVersionWire[];
  readonly nowMs: number;
  readonly selectedCode: string | null;
  readonly pendingIds: ReadonlySet<string>;
  readonly onSelect: (code: string) => void;
}

function useListBadges(versions: readonly PriceListVersionWire[], nowMs: number) {
  const { t } = useCatalogText();
  return (list: PriceListWire): CatalogListBadge[] => {
    const summary = summarizePriceList(list.id, versions, nowMs);
    const badges: CatalogListBadge[] = [];
    const from = summary.current?.validFrom;
    badges.push(from ? { label: t('pricing.list.validFrom', { date: formatDate(from) }), variant: 'outline' } : { label: t('pricing.list.notPublished'), variant: 'outline' });
    if (summary.future.length > 0) badges.push({ label: t('pricing.list.futurePending'), variant: 'secondary' });
    if (summary.drafts.length > 0) badges.push({ label: t('pricing.list.draftPending'), variant: 'secondary' });
    return badges;
  };
}

export function PriceListList({ lists, versions, nowMs, selectedCode, pendingIds, onSelect }: PriceListListProps) {
  const { t, text } = useCatalogText();
  const badgesOf = useListBadges(versions, nowMs);
  return (
    <>
      {PRICE_LIST_KINDS.map((kind) => {
        const own = lists.filter((list) => list.kind === kind).sort((a, b) => a.code.localeCompare(b.code));
        if (own.length === 0) return null;
        return (
          <CatalogListSection key={kind} title={t(SECTION_KEYS[kind])} count={own.length}>
            {own.map((list) => (
              <CatalogListItem
                key={list.id}
                primary={text(list.labels, list.code)}
                secondary={list.audience ? `${list.code} · ${t(AUDIENCE_KIND_KEYS[list.audience.kind])}` : list.code}
                icon={SECTION_ICONS[kind]}
                badges={badgesOf(list)}
                selected={selectedCode === list.code}
                pending={pendingIds.has(list.id)}
                onSelect={() => onSelect(list.code)}
              />
            ))}
          </CatalogListSection>
        );
      })}
    </>
  );
}
