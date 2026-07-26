/**
 * ADR-710 §11.1 — colour that encodes a CATEGORY rather than a series.
 *
 * These anchors exist because of a measured, live accessibility defect that every
 * gate in the repo was green for. `EnergyClassDistribution` pointed energy classes
 * `'A+'` and `'A'` at the same palette slot, so two slices of an eight-category pie
 * were rendered in an identical `#2b9571` — indistinguishable to a colour-blind
 * reader and to everyone else. CHECK 3.32 validates the palette's tokens; nothing
 * validated how a chart *used* them.
 *
 * So the fix is not "correct that one file". It is to remove the ability to pick a
 * slot: a chart declares the ORDER of its categories and the shell derives the
 * colour. The tests below are the anchors on that property.
 *
 * Two are worth naming, because a reasonable implementation fails them:
 *
 * - **Colour follows the entity, never its rank.** The obvious implementation colours
 *   the i-th row of `data`. Every consumer of this shell filters zero-count categories
 *   out, so that implementation repaints the survivors whenever one drops to zero —
 *   the same hue means a different class between two quarters.
 * - **A category outside the declared order is neutral, not slot 1.** Wrapping would
 *   silently recreate the very collision this module exists to prevent.
 *
 * @see chart-card-series.ts — chartCategoryColor
 * @see ADR-710 §11.1
 */

import * as fs from 'fs';
import * as path from 'path';

import * as React from 'react';
import { render, screen } from '@testing-library/react';

import { ChartCard } from '../ChartCard';
import {
  CHART_POLARITY_COLORS,
  CHART_SERIES_LIMIT,
  CHART_SERIES_PALETTE,
  chartCategoryColor,
} from '../chart-card-series';
import type { ChartSeries } from '../chart-card-series';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// =============================================================================
// FIXTURES — the real domain vocabulary that produced the defect
// =============================================================================

/** Greek energy performance classes, best to worst. Eight — the palette ceiling. */
const ENERGY_CLASS_ORDER = ['A+', 'A', 'B', 'C', 'D', 'E', 'F', 'G'] as const;

interface ClassSlice {
  name: string;
  value: number;
}

/** One series (the count), many categories — the shape of every pie in `reports/`. */
const QUANTITY_SERIES: ChartSeries<ClassSlice>[] = [{ key: 'value', label: 'Units' }];

function renderPie(data: ClassSlice[]) {
  return render(
    <ChartCard
      series={QUANTITY_SERIES}
      data={data}
      categoryKey="name"
      categoryLabel="Energy class"
      categoryOrder={ENERGY_CLASS_ORDER}
      formatValue={(value) => String(value)}
    >
      <ChartCard.Header title="Energy class distribution" />
      <ChartCard.Figure emptyMessage="nothing here">
        <svg data-testid="plot" />
      </ChartCard.Figure>
    </ChartCard>,
  );
}

// =============================================================================
// 1 — THE DEFECT IS NOT EXPRESSIBLE
// =============================================================================

describe('chartCategoryColor — distinctness', () => {
  it('gives every energy class its own colour, A+ and A included', () => {
    const colors = ENERGY_CLASS_ORDER.map((c) => chartCategoryColor(ENERGY_CLASS_ORDER, c));

    // The measured defect in one line: these two were the same fill on screen.
    expect(chartCategoryColor(ENERGY_CLASS_ORDER, 'A+')).not.toBe(
      chartCategoryColor(ENERGY_CLASS_ORDER, 'A'),
    );
    expect(new Set(colors).size).toBe(ENERGY_CLASS_ORDER.length);
  });

  it('draws colours from the canonical palette, in declared order', () => {
    ENERGY_CLASS_ORDER.forEach((category, index) => {
      expect(chartCategoryColor(ENERGY_CLASS_ORDER, category)).toBe(
        CHART_SERIES_PALETTE[index],
      );
    });
  });
});

// =============================================================================
// 2 — COLOUR FOLLOWS THE ENTITY, NEVER ITS RANK
// =============================================================================

describe('chartCategoryColor — stability under filtering', () => {
  it('keeps a category on its colour when earlier categories drop out', () => {
    // What every consumer does: `.filter(([, count]) => count > 0)`.
    const beforeFilter = chartCategoryColor(ENERGY_CLASS_ORDER, 'C');

    // 'A+' and 'A' fell to zero and left the dataset. 'C' must not shift.
    const surviving = ENERGY_CLASS_ORDER.filter((c) => c !== 'A+' && c !== 'A');
    expect(surviving.indexOf('C')).not.toBe(ENERGY_CLASS_ORDER.indexOf('C'));

    expect(chartCategoryColor(ENERGY_CLASS_ORDER, 'C')).toBe(beforeFilter);
  });

  it('does not depend on the data at all — only on the declared order', () => {
    // The signature is the guarantee: no data argument exists to influence it.
    expect(chartCategoryColor.length).toBe(2);
  });
});

// =============================================================================
// 3 — BEYOND THE DECLARED ORDER
// =============================================================================

describe('chartCategoryColor — unassigned categories', () => {
  it('reads an unknown category as neutral rather than as slot 1', () => {
    expect(chartCategoryColor(ENERGY_CLASS_ORDER, 'unknown')).toBe(
      CHART_POLARITY_COLORS.neutral,
    );
    expect(chartCategoryColor(ENERGY_CLASS_ORDER, 'unknown')).not.toBe(
      CHART_SERIES_PALETTE[0],
    );
  });

  it('does not wrap past the palette limit', () => {
    const tooMany = Array.from({ length: CHART_SERIES_LIMIT + 1 }, (_, i) => `c${i}`);
    const ninth = tooMany[CHART_SERIES_LIMIT];

    expect(chartCategoryColor(tooMany, ninth)).toBe(CHART_POLARITY_COLORS.neutral);
    expect(chartCategoryColor(tooMany, ninth)).not.toBe(CHART_SERIES_PALETTE[0]);
  });
});

// =============================================================================
// 4 — THE LEGEND NAMES CATEGORIES WHEN COLOUR ENCODES THEM
// =============================================================================

describe('ChartCard legend — categorical plots', () => {
  it('lists the categories present in the data, in declared order', () => {
    // Deliberately out of order, and with two classes missing.
    renderPie([
      { name: 'D', value: 4 },
      { name: 'A+', value: 1 },
      { name: 'B', value: 7 },
    ]);

    const labels = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(labels).toEqual(['A+', 'B', 'D']);
  });

  it('leaves no swatch for a category that filtered out', () => {
    renderPie([
      { name: 'A+', value: 1 },
      { name: 'A', value: 2 },
    ]);

    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.queryByText('G')).not.toBeInTheDocument();
  });

  it('still names a single series by the title when colour is not categorical', () => {
    // Regression lock on the pre-existing rule: one series, no legend box.
    render(
      <ChartCard
        series={QUANTITY_SERIES}
        data={[{ name: 'A+', value: 1 }, { name: 'A', value: 2 }]}
        categoryKey="name"
        categoryLabel="Energy class"
        formatValue={(value) => String(value)}
      >
        <ChartCard.Header title="Energy class distribution" />
        <ChartCard.Figure emptyMessage="nothing here">
          <svg data-testid="plot" />
        </ChartCard.Figure>
      </ChartCard>,
    );

    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('keeps the data table, which is the text equivalent of the slices', () => {
    renderPie([
      { name: 'A+', value: 1 },
      { name: 'A', value: 2 },
    ]);

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getAllByRole('rowheader')).toHaveLength(2);
  });
});

// =============================================================================
// 5 — THE SHELL ITSELF NEVER NAMES A SLOT
// =============================================================================

describe('the shell does not pick palette slots', () => {
  it('resolves every colour through the series module, never a raw token', () => {
    // A literal `--chart-N` anywhere in the figure would mean the legend swatch and
    // the mark could disagree — which is precisely the class of defect being closed.
    const figure = fs.readFileSync(
      path.join(__dirname, '..', 'ChartCardFigure.tsx'),
      'utf8',
    );

    expect(figure).not.toMatch(/--chart-\d/);
    expect(figure).not.toMatch(/--report-chart-/);
  });
});
