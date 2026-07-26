/**
 * ADR-710 — the chart card shell.
 *
 * Three kinds of anchor, deliberately different:
 *
 * 1. BEHAVIOURAL, on the two properties the hand-written copies did NOT have —
 *    a submit that cannot run twice, and a row list that does not wipe what the
 *    user is typing when the parent re-renders. Both were silent defects: no
 *    error, just a double write or lost input.
 *
 * 2. STRUCTURAL, on the shell's own rules — a legend for two series and none for
 *    one, and a data table that is always reachable. Those are the relief the
 *    measured palette owes (ADR-710 §4); a chart that quietly skips them looks
 *    fine and fails a colour-blind reader.
 *
 * 3. A REGRESSION SCAN over the migrated domain. Two files were migrated; a test
 *    for those two would not stop a third from being written the old way, and
 *    "imports ResponsiveContainer directly" is exactly how the other 26 got there.
 *
 * @see ADR-710 — Chart card shell SSoT
 */

import * as fs from 'fs';
import * as path from 'path';

import * as React from 'react';
import { render, screen, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';

import { ChartCard } from '../ChartCard';
import { ChartCardTooltip } from '../ChartCardTooltip';
import { useEntrySubmit } from '../editor/use-entry-submit';
import { useRepeatingRows } from '../editor/use-repeating-rows';
import { CHART_SERIES_LIMIT, chartPolarityTone, chartSeriesColor, toChartConfig } from '../chart-card-series';
import type { ChartSeries } from '../chart-card-series';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// =============================================================================
// FIXTURES
// =============================================================================

interface Point {
  year: number;
  construction: number;
  mortgage: number;
}

const DATA: Point[] = [
  { year: 2026, construction: 100, mortgage: 50 },
  { year: 2027, construction: 200, mortgage: 75 },
];

const TWO_SERIES: ChartSeries<Point>[] = [
  { key: 'construction', label: 'Construction' },
  { key: 'mortgage', label: 'Mortgage' },
];

const ONE_SERIES: ChartSeries<Point>[] = [{ key: 'construction', label: 'Construction' }];

function renderCard(series: ChartSeries<Point>[], data: Point[] = DATA) {
  return render(
    <ChartCard
      series={series}
      data={data}
      categoryKey="year"
      categoryLabel="Year"
      formatValue={(value) => `€${value}`}
    >
      <ChartCard.Header title="Maturity" />
      <ChartCard.Figure emptyMessage="nothing here">
        <svg data-testid="plot" />
      </ChartCard.Figure>
    </ChartCard>,
  );
}

// =============================================================================
// 1 — BEHAVIOUR THE COPIES DID NOT HAVE
// =============================================================================

describe('useEntrySubmit', () => {
  it('drops a second submit while the first is still in flight', async () => {
    let release: () => void = () => undefined;
    const onSubmit = jest.fn(
      () => new Promise<void>((resolve) => { release = resolve; }),
    );

    const { result } = renderHook(() => useEntrySubmit<string>({ onSubmit }));

    // Both calls are issued before either resolves — a double click.
    act(() => {
      void result.current.submit('a');
      void result.current.submit('b');
    });

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(result.current.submitting).toBe(true);

    await act(async () => { release(); });
    expect(result.current.submitting).toBe(false);
  });

  it('drops a submit that fails its validity gate, without flipping submitting', async () => {
    const onSubmit = jest.fn(async () => undefined);
    const { result } = renderHook(() =>
      useEntrySubmit<string>({ onSubmit, isValid: (value) => value.length > 0 }),
    );

    await act(async () => { await result.current.submit(''); });

    expect(onSubmit).not.toHaveBeenCalled();
    expect(result.current.submitting).toBe(false);
  });

  it('clears submitting after a rejection instead of leaving the form stuck', async () => {
    const onError = jest.fn();
    const { result } = renderHook(() =>
      useEntrySubmit<string>({ onSubmit: async () => { throw new Error('boom'); }, onError }),
    );

    await act(async () => { await result.current.submit('x'); });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(result.current.submitting).toBe(false);
  });
});

describe('useRepeatingRows', () => {
  it('keeps typed rows when the parent re-renders with a fresh seed closure', () => {
    // The regression the migrated BudgetVarianceChart had: it re-seeded from a
    // useEffect keyed on the analysis object, so a parent that rebuilt that object
    // each render wiped whatever was half-typed.
    const { result, rerender } = renderHook(
      ({ key }: { key: string }) =>
        useRepeatingRows<{ label: string }>({
          seedKey: key,
          seed: () => [{ label: 'seeded' }],
          createRow: () => ({ label: '' }),
        }),
      { initialProps: { key: 'project-1' } },
    );

    act(() => { result.current.updateRow(0, { label: 'typed by user' }); });
    rerender({ key: 'project-1' });

    expect(result.current.rows).toEqual([{ label: 'typed by user' }]);
  });

  it('re-seeds when a different record is loaded', () => {
    const { result, rerender } = renderHook(
      ({ key }: { key: string }) =>
        useRepeatingRows<{ label: string }>({
          seedKey: key,
          seed: () => [{ label: key }],
          createRow: () => ({ label: '' }),
        }),
      { initialProps: { key: 'project-1' } },
    );

    act(() => { result.current.updateRow(0, { label: 'typed' }); });
    rerender({ key: 'project-2' });

    expect(result.current.rows).toEqual([{ label: 'project-2' }]);
  });

  it('adds and removes rows', () => {
    const { result } = renderHook(() =>
      useRepeatingRows<{ label: string }>({
        seedKey: 'x',
        seed: () => [{ label: 'a' }],
        createRow: () => ({ label: 'new' }),
      }),
    );

    act(() => { result.current.addRow(); });
    expect(result.current.rows).toHaveLength(2);

    act(() => { result.current.removeRow(0); });
    expect(result.current.rows).toEqual([{ label: 'new' }]);
  });
});

// =============================================================================
// 2 — THE SHELL'S OWN RULES
// =============================================================================

describe('ChartCard', () => {
  it('renders the data table from the series description, one column per series', () => {
    renderCard(TWO_SERIES);

    // The table is the text equivalent of the plot (WCAG 1.1.1).
    expect(screen.getByRole('columnheader', { name: 'Year' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Construction' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Mortgage' })).toBeInTheDocument();

    // Values are rendered through the card's own formatValue, not stringified raw.
    expect(screen.getByRole('cell', { name: '€100' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '€75' })).toBeInTheDocument();
    expect(screen.getAllByRole('rowheader')).toHaveLength(DATA.length);
  });

  it('shows a legend for two series and none for one', () => {
    const { unmount } = renderCard(TWO_SERIES);
    expect(screen.getByRole('list')).toBeInTheDocument();
    unmount();

    renderCard(ONE_SERIES);
    // A lone series is named by the card title; a legend box for it is noise.
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('replaces the plot with the empty message and drops the table when there is no data', () => {
    renderCard(TWO_SERIES, []);

    expect(screen.getByText('nothing here')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('names the card by its title, so the region is announced by what it shows', () => {
    renderCard(TWO_SERIES);
    expect(screen.getByRole('region', { name: 'Maturity' })).toBeInTheDocument();
  });

  it('gives the tooltip the identity recharts searches its children for', () => {
    // findChildByType() matches on type.displayName. Any other name and the chart
    // still renders, nothing errors, and the tooltip simply never appears —
    // the only failure mode this wrapper has, and a silent one.
    expect(ChartCardTooltip.displayName).toBe('Tooltip');
  });

  it('throws when a slot is rendered outside a card rather than rendering blank', () => {
    // Silent degradation would look like missing data instead of missing wiring.
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<ChartCard.Header title="orphan" />)).toThrow(
      /must be rendered inside <ChartCard>/,
    );
    consoleError.mockRestore();
  });
});

// =============================================================================
// TOOLTIP — the two silent defects measured in the browser on 2026-07-27
// =============================================================================

/** What recharts hands the tooltip when the 2027 column is hovered. */
const HOVER_PAYLOAD = [
  { dataKey: 'construction', name: 'construction', value: 200, color: '#000', payload: DATA[1] },
  { dataKey: 'mortgage', name: 'mortgage', value: 75, color: '#111', payload: DATA[1] },
];

function renderHoveredCard() {
  return render(
    <ChartCard
      series={TWO_SERIES}
      data={DATA}
      categoryKey="year"
      categoryLabel="Year"
      formatValue={(value) => `€${value}`}
    >
      <ChartCard.Figure emptyMessage="nothing here">
        <ChartCardTooltip active payload={HOVER_PAYLOAD} label={DATA[1].year} />
      </ChartCard.Figure>
    </ChartCard>,
  );
}

function tooltipBox(container: HTMLElement): HTMLElement {
  const box = container.querySelector('.recharts-tooltip-wrapper');
  if (!box) throw new Error('the tooltip did not render');
  return box as HTMLElement;
}

describe('ChartCardTooltip', () => {
  it('heads the box with the category even when the category is a number', () => {
    // `ChartTooltipContent` resolves its heading with
    //   !labelKey && typeof label === 'string' ? … : itemConfig?.label
    // so a numeric category — a year, a month index, a bucket — falls through to
    // the label of the FIRST SERIES. Measured live on DebtMaturityWall: hovering
    // the 2027 column produced the heading "Κατασκευαστικό". Nothing throws.
    const { container } = renderHoveredCard();
    const heading = tooltipBox(container).querySelector('.font-medium');

    expect(heading).toHaveTextContent('2027');
    expect(heading).not.toHaveTextContent('Construction');
  });

  it('keeps each series named beside its value', () => {
    // A `formatter` replaces the WHOLE row in ChartTooltipItem — swatch, name and
    // value. Using one to format a number therefore deletes the names, and a stack
    // of four loan types reads as four bare amounts with nothing to tell them apart.
    const box = tooltipBox(renderHoveredCard().container);

    expect(box).toHaveTextContent('Construction');
    expect(box).toHaveTextContent('Mortgage');
    // …and the value still goes through the card's own formatter, not toLocaleString.
    expect(box).toHaveTextContent('€200');
    expect(box).toHaveTextContent('€75');
  });
});

describe('series description', () => {
  it('assigns categorical hues by position and never cycles', () => {
    const colors = TWO_SERIES.map((series, index) => chartSeriesColor(series, index));
    expect(colors).toEqual(['hsl(var(--chart-1))', 'hsl(var(--chart-2))']);

    // Every slot is reachable and in fixed order — asserted positionally, because the
    // ORDER is the colour-blind-safety mechanism (ADR-710 §10) and a reshuffle that kept
    // the same set of hues would otherwise pass silently.
    expect(CHART_SERIES_LIMIT).toBe(8);
    for (let i = 0; i < CHART_SERIES_LIMIT; i++) {
      expect(chartSeriesColor({ key: `s${i}`, label: `S${i}` }, i)).toBe(`hsl(var(--chart-${i + 1}))`);
    }

    // Past the ramp the palette does not wrap — a 9th series reads as unassigned rather
    // than silently repeating hue 1. Eight is the ceiling because that is where
    // categorical colour stops working for humans, not because the tokens ran out.
    expect(chartSeriesColor({ key: 'x', label: 'X' }, CHART_SERIES_LIMIT)).toBe('hsl(var(--muted-foreground))');
  });

  it('feeds ChartStyle a config whose keys match the plotted fields', () => {
    expect(toChartConfig(TWO_SERIES)).toEqual({
      construction: { label: 'Construction', color: 'hsl(var(--chart-1))' },
      mortgage: { label: 'Mortgage', color: 'hsl(var(--chart-2))' },
    });
  });

  it('reads zero as neutral, never as good', () => {
    expect(chartPolarityTone(0, 'lower-is-better')).toBe('neutral');
    expect(chartPolarityTone(5, 'lower-is-better')).toBe('bad');
    expect(chartPolarityTone(-5, 'lower-is-better')).toBe('good');
    expect(chartPolarityTone(5, 'higher-is-better')).toBe('good');
  });
});

// =============================================================================
// 3 — REGRESSION SCAN OVER THE MIGRATED DOMAIN
// =============================================================================

/**
 * Every directory ADR-710 has taken through the shell, with the files in it that are
 * still drawing their own card.
 *
 * A list only shrinks. A chart written the old way is not on it, so the scan fails —
 * which is the whole point. Phase B emptied both lists; a name reappearing here means
 * a migration went backwards, and an entry that no longer needs to be here fails the
 * second test rather than sitting around as decoration.
 */
const MIGRATED_DOMAINS: readonly { dir: string; pending: readonly string[] }[] = [
  { dir: 'src/components/sales/financial-intelligence', pending: [] },
  { dir: 'src/components/sales/payments/financial-intelligence', pending: [] },
];

describe.each(MIGRATED_DOMAINS)('$dir charts go through the shell', ({ dir, pending }) => {
  const DOMAIN = path.join(process.cwd(), dir);

  /** Matches the import, not a mention of it in a comment. */
  const DIRECT_RESPONSIVE_IMPORT = /import\s*\{[^}]*\bResponsiveContainer\b[^}]*\}\s*from\s*'recharts'/s;

  const chartFiles = fs
    .readdirSync(DOMAIN)
    .filter((file) => file.endsWith('.tsx'))
    .map((file) => ({ file, source: fs.readFileSync(path.join(DOMAIN, file), 'utf8') }))
    .filter(({ source }) => source.includes("from 'recharts'"));

  const migrated = chartFiles.filter(({ file }) => !pending.includes(file));

  it.each(migrated.map(({ file }) => file))(
    '%s does not import the recharts responsive wrapper directly',
    (file) => {
      const { source } = migrated.find((entry) => entry.file === file)!;
      // Importing it bypasses theming, legend, empty state and data table at once.
      expect(source).not.toMatch(DIRECT_RESPONSIVE_IMPORT);
    },
  );

  it('lists every unmigrated file, and no file that is already done', () => {
    // Stops the list from being padded with names that no longer need to be on it.
    const stillDirect = chartFiles
      .filter(({ source }) => DIRECT_RESPONSIVE_IMPORT.test(source))
      .map(({ file }) => file);
    expect(stillDirect.sort()).toEqual([...pending].sort());
  });

  it('every chart file in the domain reaches the shell', () => {
    // Not importing the responsive wrapper is only half of it: a file could draw a
    // recharts composition with no card around it at all and still pass the scan above.
    const outsideTheShell = migrated
      .filter(({ source }) => !source.includes("@/components/ui/chart-card"))
      .map(({ file }) => file);
    expect(outsideTheShell).toEqual([]);
  });
});

describe('the chart SSoT has no shadowing sibling', () => {
  it('has no ui/chart.tsx beside the ui/chart directory', () => {
    // ADR-710 Phase 0: the file beat the directory in module resolution, so
    // `@/components/ui/chart` silently resolved to a double-provider clone.
    expect(fs.existsSync(path.join(process.cwd(), 'src/components/ui/chart.tsx'))).toBe(false);
  });
});
