'use client';

/**
 * @module chart-card/ChartCardHeader
 * @enterprise ADR-710 — Title + actions slot.
 *
 * The title carries the card's accessible name: its `id` is the one `<ChartCard>`
 * points `aria-labelledby` at, so a screen reader announces the region by the same
 * words a sighted reader sees. Actions (a project picker, an "add entry" disclosure,
 * an export button) are children — the header does not know what they are.
 */

import type { ReactNode } from 'react';
import { useChartCard } from './chart-card-context';

export interface ChartCardHeaderProps {
  /** Translated card title. */
  readonly title: string;
  /** Controls rendered opposite the title. */
  readonly children?: ReactNode;
}

export function ChartCardHeader({ title, children }: ChartCardHeaderProps) {
  const { cardId } = useChartCard();

  return (
    <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h3 id={`${cardId}-title`} className="text-lg font-semibold text-foreground">
        {title}
      </h3>
      {children}
    </header>
  );
}
