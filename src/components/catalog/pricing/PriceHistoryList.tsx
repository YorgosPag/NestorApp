'use client';

/**
 * @fileoverview **Το ιστορικό τιμής ενός SKU** — μία γραμμή ανά δημοσιευμένη έκδοση της λίστας, νεότερη πρώτη
 *   (ADR-923 §5.11 «3δ» Τμήμα 3).
 * @related subapps/catalog/pricing/price-history.ts (τα σημεία) · VersionTimeline.tsx (ίδια σειρά: νεότερη πρώτη)
 * @module components/catalog/pricing/PriceHistoryList
 *
 * 🔑 Η έκδοση όπου το SKU **έλειπε** φαίνεται ρητά — «δεν υπήρχε» είναι πληροφορία, όχι τρύπα στη χρονογραμμή.
 * 🔑 Η μεταβολή λέγεται με πρόσημο **και** εικονίδιο (CHECK 3.41), ανά μονάδα (`unitChangeBp`).
 */

import React from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUomLabel } from '@/hooks/useUomLabel';
import { formatDate } from '@/lib/intl-formatting';
import { formatMinor } from '@/lib/money/money';
import { validityAt } from '@/lib/pricing/validity';
import type { PriceHistoryPoint } from '@/subapps/catalog/pricing/price-history';
import type { PriceListWire } from '@/subapps/catalog/types/pricing-views';
import { CatalogField } from '../shared/CatalogFormFields';
import { useCatalogText } from '../shared/catalog-ui-hooks';
import { percentOfStep } from './discount-chain-input';
import { formatDiscountPercent } from './use-discount-words';
import type { PriceAnalysis } from './use-price-analysis';

function PointRow({ point, nowMs }: { readonly point: PriceHistoryPoint; readonly nowMs: number }) {
  const { t } = useCatalogText();
  const uomLabel = useUomLabel();
  const from = formatDate(new Date(point.validFromMs));
  const current = validityAt({ fromMs: point.validFromMs, untilMs: point.validUntilMs }, nowMs) === 'valid';
  const change = point.unitChangeBp;
  const ChangeIcon = change !== null && change < 0 ? ArrowDownRight : ArrowUpRight;
  return (
    <li className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b py-1.5 text-sm last:border-b-0">
      <span className="font-medium">{t('pricing.analysis.history.version', { number: point.versionNumber })}</span>
      <span className="text-xs text-muted-foreground">{t('pricing.analysis.history.from', { from })}</span>
      {current ? <Badge variant="default">{t('pricing.analysis.history.current')}</Badge> : null}
      {point.line === null ? (
        <span className="ml-auto text-xs text-muted-foreground">{t('pricing.analysis.history.absent')}</span>
      ) : (
        <span className="ml-auto flex items-baseline gap-2 tabular-nums">
          {change !== null && change !== 0 ? (
            <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
              <ChangeIcon className="h-3 w-3" aria-hidden />
              {t(change > 0 ? 'pricing.analysis.history.rose' : 'pricing.analysis.history.fell', { percent: formatDiscountPercent(percentOfStep(Math.abs(change))) })}
            </span>
          ) : null}
          {t('pricing.analysis.pricePer', { price: formatMinor(point.line.netPrice), quantity: point.line.priceQuantity, unit: uomLabel(point.line.unitCode) })}
        </span>
      )}
    </li>
  );
}

function HistoryBody({ analysis, nowMs }: { readonly analysis: PriceAnalysis; readonly nowMs: number }) {
  const { t } = useCatalogText();
  const { history, historyListId } = analysis;
  if (historyListId === null) return <p className="m-0 text-sm text-muted-foreground">{t('pricing.analysis.history.pickList')}</p>;
  if (history.error !== null) return <p className="m-0 text-sm" role="alert">{t('pricing.analysis.failed')}</p>;
  const points = history.data?.priceListId === historyListId ? history.data.points : null;
  if (points === null) return <p className="m-0 text-sm text-muted-foreground" role="status">{t('pricing.analysis.loading')}</p>;
  if (points.length === 0) return <p className="m-0 text-sm text-muted-foreground">{t('pricing.analysis.history.empty')}</p>;
  return <ol className="m-0 flex list-none flex-col p-0">{[...points].reverse().map((point) => <PointRow key={point.versionId} point={point} nowMs={nowMs} />)}</ol>;
}

export function PriceHistoryList({ analysis, lists, nowMs }: {
  readonly analysis: PriceAnalysis;
  readonly lists: readonly PriceListWire[];
  readonly nowMs: number;
}) {
  const { t, text } = useCatalogText();
  return (
    <section className="flex flex-col gap-2 rounded-md border bg-card p-3">
      <h4 className="m-0 text-sm font-semibold">{t('pricing.analysis.history.title')}</h4>
      <CatalogField label={t('pricing.analysis.list')}>
        {({ id, describedBy }) => (
          <Select value={analysis.historyListId ?? undefined} onValueChange={analysis.setChosenList}>
            <SelectTrigger id={id} aria-describedby={describedBy} className="max-w-sm"><SelectValue placeholder={t('pricing.analysis.history.pickList')} /></SelectTrigger>
            <SelectContent>
              {lists.map((list) => <SelectItem key={list.id} value={list.id}>{text(list.labels, list.code)}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </CatalogField>
      <HistoryBody analysis={analysis} nowMs={nowMs} />
    </section>
  );
}
