'use client';

/**
 * **Η τάση ζητούμενων ενός τμήματος** — μεταβολή διαμέσου 3/6/12 μηνών και η μηνιαία γραμμή (ADR-890 §13, Φ3).
 *
 * 🔑 **Τίμια όταν δεν φτάνουν τα δεδομένα**: κάτω από {@link ASKING_TREND_MIN_POINTS} μήνες με αριθμό, **καμία**
 * γραμμή — μόνο «η μέτρηση ξεκίνησε τον …, η γραμμή εμφανίζεται όταν …». Δύο σημεία δεν είναι τάση, και ένα
 * γράφημα με μία κουκκίδα θα έμοιαζε με σφάλμα.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCalendarMonth } from '@/lib/intl-formatting';
import { MARKET_STAT_MIN_SAMPLE } from '@/lib/market/market-statistics';

import { signedPercentLabel } from './area-market-format';
import { ASKING_TREND_MIN_POINTS, type AskingTrendView } from './area-market-insight-view';
import { LazyMarketTrendChart } from './LazyMarketTrendChart';

const NS = 'area-market';

interface AreaAskingTrendProps {
  readonly trend: AskingTrendView;
  readonly formatPrice: (amount: number) => string;
}

export function AreaAskingTrend({ trend, formatPrice }: AreaAskingTrendProps) {
  const { t } = useTranslation([NS]);
  return (
    <>
      {trend.changes.length > 0 && (
        <p className="m-0 text-sm text-foreground">
          {t(`${NS}:trend.changes`)}
          {': '}
          {trend.changes.map((change) => t(`${NS}:trend.change`, { months: change.months, pct: signedPercentLabel(change.pct) })).join(' · ')}
        </p>
      )}
      {trend.reported >= ASKING_TREND_MIN_POINTS ? (
        <LazyMarketTrendChart period="month" points={trend.points.map((point) => ({ period: point.month, cell: point.cell }))} formatPrice={formatPrice} />
      ) : (
        <p className="m-0 text-xs text-muted-foreground">
          {t(`${NS}:trend.pending`, {
            since: formatCalendarMonth(trend.since),
            months: ASKING_TREND_MIN_POINTS,
            min: MARKET_STAT_MIN_SAMPLE,
          })}
        </p>
      )}
    </>
  );
}
