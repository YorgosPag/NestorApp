'use client';

/**
 * @module chart-card/ChartCardHeader
 * @enterprise ADR-710 — Title + actions slot.
 *
 * The title carries the card's accessible name: its `id` is the one `<ChartCard>`
 * points `aria-labelledby` at, so a screen reader announces the region by the same
 * words a sighted reader sees. Actions (a project picker, an "add entry" disclosure,
 * an export button) are children — the header does not know what they are.
 *
 * The heading **element** is read from the card context, never hardcoded: the same card
 * is an `<h3>` on a page and an `<h4>` inside a `ReportSection` that already spent the
 * `<h3>`. Hardcoding it here is what put an `<h3>` inside an `<h3>` — see
 * `surface-context.tsx`. The visual size stays fixed regardless of level, because
 * heading level is document structure and type scale is design.
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
  const { cardId, headingTag: Heading } = useChartCard();

  return (
    <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <Heading id={`${cardId}-title`} className="text-lg font-semibold text-foreground">
        {title}
      </Heading>
      {children}
    </header>
  );
}
