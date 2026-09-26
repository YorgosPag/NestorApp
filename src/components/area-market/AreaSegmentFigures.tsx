'use client';

/**
 * **Ένα τμήμα αγοράς μιας προσφοράς** — ο κύριος αριθμός (διάμεσος €/τ.μ. + μεσαίο 50% + πλήθος) και οι
 * πίνακες ανάλυσης (ADR-890 Φ1).
 *
 * 🔑 **Κάτω από το κατώφλι, ΠΟΤΕ αριθμός της περιοχής.** Δείχνεται το πλήθος και, όπου ο Δήμος έχει αριθμό για
 * το ίδιο τμήμα, ο αριθμός **του Δήμου με το όνομά του** (αναγωγή όπως το ONS) — ποτέ ντυμένος ως τοπικός.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { isReportedStatCell, MARKET_STAT_MIN_SAMPLE, type ReportedStatCell } from '@/lib/market/market-statistics';
import type { AskingOffer } from '@/types/area-market';

import { askingAmountLabel, unitPriceLabel } from './area-market-format';
import { breakdownViews, type SegmentView } from './area-market-view';
import { AreaBreakdownTable } from './AreaBreakdownTable';

const NS = 'area-market';

interface AreaSegmentFiguresProps {
  readonly offer: AskingOffer;
  readonly view: SegmentView;
  /** Το όνομα του γονέα για την αναγωγή — `null` όταν η σελίδα είναι ήδη Δήμος. */
  readonly parentName: string | null;
}

function ReportedHeadline({ offer, view, cell }: { readonly offer: AskingOffer; readonly view: SegmentView; readonly cell: ReportedStatCell }) {
  const { t } = useTranslation([NS, 'common']);
  const { price, size } = view.summary;
  return (
    <>
      <p className="m-0 text-sm text-muted-foreground">{t(`${NS}:card.medianPerArea`)}</p>
      <p className="m-0 text-3xl font-semibold tabular-nums text-foreground">
        <data value={cell.median}>{unitPriceLabel(t, offer, view.segment, cell.median)}</data>
      </p>
      <p className="m-0 text-sm text-foreground">
        {t(`${NS}:card.range`, {
          low: unitPriceLabel(t, offer, view.segment, cell.p25),
          high: unitPriceLabel(t, offer, view.segment, cell.p75),
        })}
      </p>
      <p className="m-0 text-sm text-muted-foreground">{t(`${NS}:card.sample`, { count: cell.n })}</p>
      {isReportedStatCell(price) && (
        <p className="m-0 text-sm text-muted-foreground">
          {t(`${NS}:card.medianPrice`, { price: askingAmountLabel(t, offer, price.median) })}
        </p>
      )}
      {isReportedStatCell(size) && (
        <p className="m-0 text-sm text-muted-foreground">{t(`${NS}:card.medianSize`, { size: size.median })}</p>
      )}
    </>
  );
}

function SuppressedHeadline({ offer, view, parentName }: AreaSegmentFiguresProps) {
  const { t } = useTranslation([NS, 'common']);
  const parent = view.parentUnitPrice;
  return (
    <>
      <p className="m-0 text-sm text-foreground">
        {t(`${NS}:card.suppressed`, { count: view.summary.unitPrice.n, min: MARKET_STAT_MIN_SAMPLE })}
      </p>
      {parent !== null && parentName !== null && (
        <p className="m-0 text-sm text-muted-foreground">
          {t(`${NS}:card.parentFallback`, {
            name: parentName,
            price: unitPriceLabel(t, offer, view.segment, parent.median),
            count: parent.n,
          })}
        </p>
      )}
    </>
  );
}

export function AreaSegmentFigures({ offer, view, parentName }: AreaSegmentFiguresProps) {
  const { t } = useTranslation([NS]);
  const headline = view.summary.unitPrice;
  const breakdowns = isReportedStatCell(headline) ? breakdownViews(view.segment, view.summary) : [];
  return (
    <article className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <header className="flex flex-col gap-1">
        <h3 className="m-0 text-base font-semibold text-foreground">{t(`${NS}:segment.${view.segment}`)}</h3>
        {isReportedStatCell(headline)
          ? <ReportedHeadline offer={offer} view={view} cell={headline} />
          : <SuppressedHeadline offer={offer} view={view} parentName={parentName} />}
      </header>
      {breakdowns.map((breakdown) => (
        <AreaBreakdownTable key={breakdown.axis} offer={offer} segment={view.segment} view={breakdown} />
      ))}
    </article>
  );
}
