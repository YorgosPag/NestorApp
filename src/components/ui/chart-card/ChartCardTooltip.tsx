'use client';

/**
 * @module chart-card/ChartCardTooltip
 * @enterprise ADR-710 — The hover layer, wired to the card's own formatter.
 *
 * An HTML chart is interactive, so a tooltip is the default rather than an option.
 * Every migrated chart wired its own `<Tooltip formatter={…}>`, and each formatter
 * was a private re-statement of how that card renders a number — which is how
 * `BudgetVarianceChart` ended up concatenating three values into a single tooltip
 * string while `DebtMaturityWall` returned a pair. Here it reads `formatValue` from
 * the card, so axis tick, tooltip and data table cannot disagree.
 *
 * The heading of the hover box is the category, so it goes through the card's
 * `formatCategory` for the same reason: the row header of the data table and the
 * heading of the tooltip name the same datum and must name it the same way. A chart
 * whose category carries more than its own value — a month that is also a project
 * phase — states that once, in `formatCategory`, and both readers pick it up.
 *
 * ## Why the heading is read off `categoryKey` and not off recharts' `label`
 *
 * `ChartTooltipContent` resolves its heading with
 * `!labelKey && typeof label === 'string' ? … : itemConfig?.label` — so the moment a
 * category is a **number** the condition fails and the heading silently becomes the
 * label of the *first series*. Measured on `DebtMaturityWall`, whose category is a
 * year: hovering the 2027 column produced the heading "Κατασκευαστικό". Nothing
 * throws, the box appears, and it names the wrong thing.
 *
 * So the heading is read from the hovered datum through the card's own `categoryKey`
 * — the same key that feeds the axis and the data table — and falls back to recharts'
 * `label` only when the payload carries no datum.
 *
 * ## Why `valueFormatter` and not `formatter`
 *
 * A `formatter` replaces the **entire** row in `ChartTooltipItem`: swatch, series name
 * and value. Passing one to format a number therefore deletes the names, and a stack
 * of four loan types reads as four bare amounts. `valueFormatter` formats the number
 * and leaves the row intact.
 *
 * ## Why `displayName` is `'Tooltip'` and why props are spread
 *
 * recharts does not render its children directly. `generateCategoricalChart` looks
 * them up with `findChildByType(children, Tooltip)`, which matches on
 * `type.displayName`, and then hands the hovered data to the element it found via
 * `cloneElement`. A wrapper named anything else is never found: the chart renders,
 * nothing errors, and the tooltip simply never appears.
 *
 * So this component takes the identity recharts searches for, and forwards
 * everything — both what recharts reads off the element beforehand (`active`,
 * `trigger`, `shared`) and what it injects afterwards (`payload`, `label`,
 * `coordinate`, `viewBox`) — to the real primitive underneath.
 *
 * The `displayName` is asserted in `__tests__/chart-card.test.tsx`; dropping it
 * would be a silent regression, which is the only kind this file can produce.
 */

import { useCallback, type ComponentProps, type ReactNode } from 'react';
import { ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import type { TooltipPayload, TooltipPayloadItem } from '@/components/ui/chart/tooltip/types';
import { readChartField, useChartCard } from './chart-card-context';

export type ChartCardTooltipProps = ComponentProps<typeof ChartTooltip> & {
  /** Swatch shape beside each series row. */
  readonly indicator?: 'dot' | 'line' | 'dashed';
};

export function ChartCardTooltip({ indicator = 'dot', ...tooltipProps }: ChartCardTooltipProps) {
  const { formatValue, formatCategory, categoryKey } = useChartCard();

  const format = useCallback(
    (value: number, _item: TooltipPayloadItem) => formatValue(value),
    [formatValue],
  );

  const formatLabel = useCallback(
    (label: ReactNode, payload: TooltipPayload) => {
      const datum = payload?.[0]?.payload;
      const category = datum === undefined ? undefined : readChartField(datum, categoryKey);
      return formatCategory(category ?? label);
    },
    [formatCategory, categoryKey],
  );

  return (
    <ChartTooltip
      {...tooltipProps}
      content={
        <ChartTooltipContent
          indicator={indicator}
          valueFormatter={format}
          labelFormatter={formatLabel}
        />
      }
    />
  );
}

/** The identity recharts searches its children for — see the module doc. */
ChartCardTooltip.displayName = 'Tooltip';
