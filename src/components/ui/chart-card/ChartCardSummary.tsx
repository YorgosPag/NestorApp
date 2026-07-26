'use client';

/**
 * @module chart-card/ChartCardSummary
 * @enterprise ADR-710 — The totals strip under a plot.
 *
 * A description list, because that is what it is: each entry is a term and its value.
 * Rendering it as a row of `<div>`s (as the migrated cards did) loses the pairing for
 * anyone not reading the layout.
 *
 * Tone is an enumerated token, never a color. The caller decides *meaning* with
 * `chartPolarityTone()`; the mapping from meaning to ink lives here, once.
 */

import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';
import type { ChartTone } from './chart-card-series';

const TONE_TEXT: Record<ChartTone, string> = {
  neutral: 'text-foreground',
  good: 'text-[hsl(var(--text-success))]',
  bad: 'text-destructive',
};

export interface ChartCardSummaryProps {
  readonly children: ReactNode;
}

export function ChartCardSummary({ children }: ChartCardSummaryProps) {
  return (
    <section className="mb-6 flex flex-wrap gap-x-6 gap-y-2 text-sm">{children}</section>
  );
}

export interface ChartCardSummaryItemProps {
  /** Translated term. */
  readonly label: string;
  /** Already-formatted value. */
  readonly value: string;
  /** Meaning of the value, if it has one. Defaults to neutral. */
  readonly tone?: ChartTone;
}

export function ChartCardSummaryItem({
  label,
  value,
  tone = 'neutral',
}: ChartCardSummaryItemProps) {
  return (
    <dl className="flex gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn('font-medium tabular-nums', TONE_TEXT[tone])}>{value}</dd>
    </dl>
  );
}
