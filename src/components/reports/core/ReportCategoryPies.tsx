'use client';

/**
 * @module reports/core/ReportCategoryPies
 * @enterprise ADR-265 · ADR-710 Φάση Γ, Βήμα 3
 *
 * One or two pies of "how many of each", side by side.
 *
 * ## Why this exists
 *
 * It is the single most repeated shape in this domain — twelve of the sixteen pies count
 * rows per category — and the repetition is not one line. Each copy declared the same
 * one-value series, the same count formatter, the same small figure step, the same
 * two-column grid and the same "render this one only if it has rows" guard. Four files
 * had it twice over.
 *
 * That was caught by the token-level clone detector on the way in (N.18 / ADR-584), not
 * by review: the copies were not identical text, they were the same structure with
 * different words, which is exactly the class of duplication a name-based scan cannot see.
 *
 * ## What stays at the call site
 *
 * The two things that are genuinely about the domain and cannot be defaulted: the
 * translated name of what the categories are, and the **declared order** of the category
 * vocabulary, which is what gives each slice its colour (ADR-710 §11.6). Everything else
 * is the same question answered the same way, so it is answered once, here.
 */

import '@/lib/design-system';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ChartCardFigureSize, ChartSeries } from '@/components/ui/chart-card';
import { formatNumber } from '@/lib/intl-utils';
import { ReportChart } from './ReportChart';

/** One counted category: what it is, and how many. */
export interface ReportCategorySlice {
  name: string;
  value: number;
}

export interface ReportCategoryPie {
  /** The counted rows. An empty one is skipped rather than drawn blank. */
  readonly data: readonly ReportCategorySlice[];
  /** Translated name of what the categories are — the data table column header. */
  readonly categoryLabel: string;
  /**
   * The category vocabulary in canonical order. The slice colour is a position in it,
   * never the position of the row, so filtering a category out leaves the rest alone.
   */
  readonly categoryOrder: readonly string[];
  /** Translated name of the measured quantity. Defaults to a plain count. */
  readonly valueLabel?: string;
  /** How the quantity reads. Defaults to a locale-formatted whole number. */
  readonly formatValue?: (value: number) => string;
}

export interface CategoryPieSpec {
  /** The counted rows. */
  readonly data: readonly ReportCategorySlice[];
  /** Key naming what the categories are, in the `reports` namespace. */
  readonly labelKey: string;
  /** The vocabulary, in canonical order — usually an enum SSoT, never the row order. */
  readonly keys: readonly string[];
  /** Locale group the vocabulary is translated through, without the trailing dot. */
  readonly keyPrefix: string;
  /** Translated name of the measured quantity. Defaults to a plain count. */
  readonly valueLabel?: string;
  /** How the quantity reads. Defaults to a locale-formatted whole number. */
  readonly formatValue?: (value: number) => string;
}

/**
 * A vocabulary plus its rows, resolved into one declared pie.
 *
 * This is the step every one of these charts repeats: translate the canonical keys in
 * order, and hand the result over as the colour order. Written out per chart it is four
 * lines of identical structure with two words changed — the exact shape the clone
 * detector flags and a reviewer reads straight past.
 *
 * The rows carry translated names (the report hooks build them that way), so the order
 * is translated to match. What stays canonical is the **sequence**, which is what the
 * colour is actually taken from.
 */
export function buildCategoryPie(
  t: (key: string) => string,
  spec: CategoryPieSpec,
): ReportCategoryPie {
  return {
    data: spec.data,
    categoryLabel: t(spec.labelKey),
    categoryOrder: spec.keys.map((key) => t(`${spec.keyPrefix}.${key}`)),
    valueLabel: spec.valueLabel,
    formatValue: spec.formatValue,
  };
}

export interface ReportCategoryPiesProps {
  /** One pie, or two to be compared side by side. */
  readonly charts: readonly ReportCategoryPie[];
  /** Figure step. A pair sits at `sm`; a lone pie is usually given more room. */
  readonly size?: ChartCardFigureSize;
}

export function ReportCategoryPies({ charts, size = 'sm' }: ReportCategoryPiesProps) {
  const { t } = useTranslation('reports');

  const countSeries = useMemo<ChartSeries<ReportCategorySlice>[]>(
    () => [{ key: 'value', label: t('chart.series.count') }],
    [t],
  );

  const drawn = charts.filter((chart) => chart.data.length > 0);
  if (drawn.length === 0) return null;

  const pies = drawn.map((chart) => (
    <ReportChart
      key={chart.categoryLabel}
      type="pie"
      data={chart.data}
      series={
        chart.valueLabel ? [{ key: 'value', label: chart.valueLabel }] : countSeries
      }
      categoryKey="name"
      categoryLabel={chart.categoryLabel}
      categoryOrder={chart.categoryOrder}
      formatValue={chart.formatValue ?? formatNumber}
      size={size}
    />
  ));

  // A lone pie takes the full width; a pair splits it once there is room to split.
  if (pies.length === 1) return pies[0];

  return <div className="grid grid-cols-1 gap-6 md:grid-cols-2">{pies}</div>;
}
