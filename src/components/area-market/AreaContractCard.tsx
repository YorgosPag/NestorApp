'use client';

/**
 * **Ένα τμήμα αγοράς στις τιμές συμβολαίων** — διάμεσος 12μήνου, μεσαίο 50%, τιμή ζώνης, απόσταση από τις
 * ζητούμενες, τάση 8 τριμήνων, ανάλυση ανά έτος κατασκευής (ADR-890 Φ2).
 *
 * 🔑 **Τρεις τιμές, τρεις ετικέτες** (ADR-890 §3): ζητούμενη · συμβολαίου · ζώνης. Κανένας αριθμός χωρίς να λέει
 * ποια από τις τρεις είναι, και **ποτέ** «αγοραία αξία».
 */

import dynamic from 'next/dynamic';
import React from 'react';

import { ContractMedian } from '@/components/market/ContractMedian';
import { ChartBandPending } from '@/components/ui/chart-card/ChartBandPending';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatPercentage } from '@/lib/intl-formatting';
import { isReportedStatCell, MARKET_STAT_MIN_SAMPLE, type ReportedStatCell } from '@/lib/market/market-statistics';

import type { ContractSegmentView } from './area-contracts-view';
import { unitPriceLabel } from './area-market-format';
import { AreaBreakdownTable } from './AreaBreakdownTable';

const NS = 'market-contracts';

const ContractTrendChart = dynamic(() => import('./ContractTrendChart'), {
  ssr: false,
  loading: () => <ChartBandPending size="sm" captioned />,
});

interface AreaContractCardProps {
  readonly view: ContractSegmentView;
  /** Το όνομα του Δήμου για την αναγωγή — `null` όταν η σελίδα είναι ήδη Δήμος. */
  readonly parentName: string | null;
}

function Headline({ view, cell, price }: { readonly view: ContractSegmentView; readonly cell: ReportedStatCell; readonly price: (n: number) => string }) {
  return (
    <>
      <ContractMedian cell={cell} price={price} size="lg" />
      {view.askGapPct !== null && <AskGap pct={view.askGapPct} />}
    </>
  );
}

function AskGap({ pct }: { readonly pct: number }) {
  const { t } = useTranslation([NS]);
  const key = pct > 0 ? 'askAbove' : pct < 0 ? 'askBelow' : 'askEqual';
  return <p className="m-0 text-sm font-medium text-foreground">{t(`${NS}:card.${key}`, { pct: Math.abs(pct) })}</p>;
}

function Suppressed({ view, parentName, price }: AreaContractCardProps & { readonly price: (n: number) => string }) {
  const { t } = useTranslation([NS]);
  const parent = view.parentLast12;
  return (
    <>
      <p className="m-0 text-sm text-foreground">{t(`${NS}:card.suppressed`, { count: view.summary.last12.n, min: MARKET_STAT_MIN_SAMPLE })}</p>
      {parent !== null && parentName !== null && (
        <p className="m-0 text-sm text-muted-foreground">
          {t(`${NS}:card.parentFallback`, { name: parentName, price: price(parent.median), count: parent.n })}
        </p>
      )}
    </>
  );
}

/** Πηγή Γ: τιμή ζώνης και λόγος τιμήματος προς αυτήν — μόνο όπου δημοσιεύονται. */
function ZoneFigures({ view, price }: { readonly view: ContractSegmentView; readonly price: (n: number) => string }) {
  const { t } = useTranslation([NS]);
  const { zone, priceToZonePct } = view.summary;
  if (zone === null || !isReportedStatCell(zone)) return null;
  return (
    <>
      <p className="m-0 text-sm text-muted-foreground">{t(`${NS}:card.zone`, { price: price(zone.median) })}</p>
      {priceToZonePct !== null && isReportedStatCell(priceToZonePct) && (
        <p className="m-0 text-sm text-muted-foreground">{t(`${NS}:card.priceToZone`, { pct: priceToZonePct.median })}</p>
      )}
    </>
  );
}

const signedPct = (pct: number): string => formatPercentage(pct, { maximumFractionDigits: 0, signDisplay: 'exceptZero' });

/**
 * Ανά έτος κατασκευής, με τη στήλη «Ζητούν» δίπλα στη διάμεσο (ADR-890 §12): η στήλη υπάρχει **μόνο** όταν έστω ένας
 * κάδος έχει και τις δύο πηγές πάνω από το κατώφλι — αλλιώς θα ήταν στήλη από παύλες.
 */
function YearBuiltTable({ view, price }: { readonly view: ContractSegmentView; readonly price: (n: number) => string }) {
  const { t } = useTranslation([NS]);
  if (view.yearBuilt.length === 0) return null;
  const compared = view.yearBuilt.some((row) => row.askGapPct !== null);
  return (
    <AreaBreakdownTable
      caption={t(`${NS}:yearBuilt.title`)}
      bucketHeader={t(`${NS}:yearBuilt.columnBucket`)}
      countHeader={t(`${NS}:yearBuilt.columnCount`)}
      rows={view.yearBuilt.map((row) => ({
        key: row.key,
        label: t(`${NS}:yearBuilt.bucket.${row.key}`),
        cell: row.cell,
        comparison: row.askGapPct === null ? null : signedPct(row.askGapPct),
      }))}
      formatPrice={price}
      belowThreshold={t(`${NS}:yearBuilt.belowThreshold`, { min: MARKET_STAT_MIN_SAMPLE })}
      comparisonHeader={compared ? t(`${NS}:yearBuilt.askGapColumn`) : null}
      footnote={compared ? t(`${NS}:yearBuilt.askGapNote`, { min: MARKET_STAT_MIN_SAMPLE }) : null}
    />
  );
}

export function AreaContractCard({ view, parentName }: AreaContractCardProps) {
  const { t } = useTranslation([NS, 'area-market', 'common']);
  const price = (amount: number): string => unitPriceLabel(t, 'sale', view.segment, amount);
  const headline = view.summary.last12;
  const hasTrend = view.trend.some((point) => isReportedStatCell(point.cell));
  return (
    <article className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <header className="flex flex-col gap-1">
        <h3 className="m-0 text-base font-semibold text-foreground">{t(`area-market:segment.${view.segment}`)}</h3>
        {isReportedStatCell(headline)
          ? <Headline view={view} cell={headline} price={price} />
          : <Suppressed view={view} parentName={parentName} price={price} />}
        <ZoneFigures view={view} price={price} />
      </header>
      {hasTrend && <ContractTrendChart points={view.trend} formatPrice={price} />}
      {isReportedStatCell(headline) && <YearBuiltTable view={view} price={price} />}
    </article>
  );
}
