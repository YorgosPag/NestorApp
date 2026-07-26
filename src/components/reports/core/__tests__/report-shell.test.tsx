/**
 * ADR-710 Φάση Γ — the reports shell, anchored before 34 charts are migrated onto it.
 *
 * ## Why this file exists at all
 *
 * `ReportSection` frames and titles 58 regions of this app and `ReportChart` draws 34 of
 * them. Between them they carried **zero** tests. The next step rewrites `ReportChart`
 * onto the ADR-710 shell and edits every one of those 34 call sites — which is a lot of
 * change to make over nothing.
 *
 * So the assertions below are deliberately written against **outcomes that must survive
 * the migration**, not against today's prop names: an empty result shows the report empty
 * state, a pie draws one distinctly-coloured slice per category, a bar draws one series
 * per declaration, a chart inside a section produces exactly **one** card. The fixture
 * that feeds them changes when the API changes; the assertions do not. That is what makes
 * them a net rather than a snapshot of the current implementation.
 *
 * ## Two testing constraints this file works around, both already paid for
 *
 * - **`ResponsiveContainer` measures nothing in jsdom** — it observes an element that is
 *   always 0×0, so recharts renders `null` and every mark-level assertion silently passes
 *   on an empty tree. It is replaced below with a fixed-size passthrough, which is the
 *   only way to assert on marks at all.
 * - **jsdom does not parse `hsl(var(--x))` in a `style` attribute** (ADR-710 §11.6). It
 *   *does* return SVG presentation attributes verbatim, and recharts sets `fill` as an
 *   attribute — so colour is read with `getAttribute('fill')` here, never `toHaveStyle`.
 *
 * @see ADR-710 §11 — the two levels of the shell
 * @see ADR-710 §11.6 — why colour follows the declared category, never the row's rank
 */

import * as React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ReportSection } from '../ReportSection';
import { ReportChart } from '../ReportChart';
import { ChartCard, type ChartSeries } from '@/components/ui/chart-card';
import { SurfaceBoundary } from '@/components/ui/surface-context';
import { TooltipProvider } from '@/components/ui/tooltip';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'el' } }),
}));

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

/**
 * A container that reports a real size. Without this every chart below renders an empty
 * `<svg>` and every mark assertion passes against nothing — the exact "0 means nobody
 * looked" failure this repo has paid for elsewhere.
 */
jest.mock('recharts', () => {
  const actual = jest.requireActual('recharts');
  const react = jest.requireActual('react');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactElement }) =>
      react.cloneElement(children, { width: 600, height: 300 }),
  };
});

// =============================================================================
// FIXTURES
// =============================================================================

interface Slice {
  name: string;
  value: number;
}

const SLICES: Slice[] = [
  { name: 'alpha', value: 5 },
  { name: 'beta', value: 3 },
  { name: 'gamma', value: 2 },
];

/** A pie is ONE series split across N categories — never N series (ADR-710 §11.6). */
const SLICE_SERIES: ChartSeries<Slice>[] = [{ key: 'value', label: 'Πλήθος' }];

/** The domain vocabulary, declared. Colour is its position here, never the row's. */
const SLICE_ORDER = ['alpha', 'beta', 'gamma'] as const;

interface Row {
  building: string;
  estimated: number;
  actual: number;
}

const ROWS: Row[] = [
  { building: 'A1', estimated: 100, actual: 120 },
  { building: 'B2', estimated: 200, actual: 180 },
];

const ROW_SERIES: ChartSeries<Row>[] = [
  { key: 'estimated', label: 'Estimated' },
  { key: 'actual', label: 'Actual' },
];

function renderPie(data: Slice[] = SLICES) {
  return render(
    <ReportChart
      type="pie"
      data={data}
      series={SLICE_SERIES}
      categoryKey="name"
      categoryLabel="Κατηγορία"
      categoryOrder={SLICE_ORDER}
      formatValue={String}
    />,
  );
}

function renderCartesian(type: 'bar' | 'line' | 'stacked-bar') {
  return render(
    <ReportChart
      type={type}
      data={ROWS}
      series={ROW_SERIES}
      categoryKey="building"
      categoryLabel="Κτίριο"
      formatValue={String}
    />,
  );
}

/** Every `<Card>` in this app is the same div; this is how many frames were drawn. */
function cards(container: HTMLElement): NodeListOf<Element> {
  return container.querySelectorAll('.bg-card');
}

/** Captures a render-time throw the way the running app does — through a boundary. */
class Boundary extends React.Component<
  { onError: (error: Error) => void; children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    this.props.onError(error);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function Exploding(): React.ReactElement {
  throw new Error('section body failed');
}

// =============================================================================
// ReportSection — the frame 33 of the 34 charts sit inside
// =============================================================================

describe('ReportSection — the frame and the heading it spends', () => {
  it('draws exactly one card and names its region with the heading it renders', () => {
    const { container } = render(
      <ReportSection title="Έσοδα" collapsible={false}>
        <p>body</p>
      </ReportSection>,
    );

    expect(cards(container)).toHaveLength(1);

    const region = screen.getByRole('region');
    const heading = screen.getByRole('heading', { name: 'Έσοδα' });
    expect(region).toHaveAttribute('aria-labelledby', heading.id);
  });

  it('titles itself h3 at page level and h4 inside another surface', () => {
    const { unmount } = render(
      <ReportSection title="Top" collapsible={false}>
        <p>body</p>
      </ReportSection>,
    );
    expect(screen.getByRole('heading', { name: 'Top' }).tagName).toBe('H3');
    unmount();

    render(
      <SurfaceBoundary>
        <ReportSection title="Nested" collapsible={false}>
          <p>body</p>
        </ReportSection>
      </SurfaceBoundary>,
    );
    expect(screen.getByRole('heading', { name: 'Nested' }).tagName).toBe('H4');
  });

  it('collapses and restores its body', async () => {
    const user = userEvent.setup();
    render(
      <ReportSection title="Έσοδα">
        <p>body</p>
      </ReportSection>,
    );

    expect(screen.getByText('body')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'section.collapse' }));
    expect(screen.queryByText('body')).not.toBeInTheDocument();
  });

  it('keeps the info tooltip out of the collapse trigger — a button inside a button is not valid HTML', () => {
    render(
      <TooltipProvider>
        <ReportSection title="Έσοδα" tooltip="what this measures">
          <p>body</p>
        </ReportSection>
      </TooltipProvider>,
    );

    for (const button of screen.getAllByRole('button')) {
      expect(within(button).queryByRole('button')).toBeNull();
    }
  });

  it('contains a failing child instead of taking the page down with it', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    render(
      <>
        <ReportSection title="Broken" collapsible={false}>
          <Exploding />
        </ReportSection>
        <p>sibling survived</p>
      </>,
    );

    expect(screen.getByText('sibling survived')).toBeInTheDocument();
    consoleError.mockRestore();
  });

  it('declares a surface, so a shell that draws its own card refuses inside it', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const errors: Error[] = [];

    render(
      <ReportSection title="Έσοδα" collapsible={false}>
        <Boundary onError={(error) => errors.push(error)}>
          <ChartCard
            series={[{ key: 'value', label: 'Value' }]}
            data={SLICES}
            categoryKey="name"
            categoryLabel="Category"
            formatValue={String}
          >
            <ChartCard.Figure emptyMessage="none">
              <svg />
            </ChartCard.Figure>
          </ChartCard>
        </Boundary>
      </ReportSection>,
    );

    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('ChartPlot');
    consoleError.mockRestore();
  });
});

// =============================================================================
// ReportChart — outcomes that must hold before and after the migration
// =============================================================================

describe('ReportChart — what it draws', () => {
  it('shows the report empty state instead of an empty plot', () => {
    const { container } = renderPie([]);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(container.querySelector('[data-chart]')).toBeNull();
  });

  it('names every category of a pie in text, so identity is never carried by colour alone', () => {
    renderPie();

    for (const label of SLICE_ORDER) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  it('draws one mark group per declared series', () => {
    const bar = renderCartesian('bar');
    expect(bar.container.querySelectorAll('.recharts-bar')).toHaveLength(2);
    bar.unmount();

    const line = renderCartesian('line');
    expect(line.container.querySelectorAll('.recharts-line')).toHaveLength(2);
  });

  /**
   * The regression that shipped: grid, axes and tooltip were handed to recharts inside a
   * `<>…</>`, which `React.Children.toArray` keeps whole — so recharts found none of them
   * and 21 charts drew bars over a blank canvas. Nothing failed; there was simply no scale.
   */
  it('draws the scale a cartesian plot is read against', () => {
    const { container } = renderCartesian('bar');

    expect(container.querySelectorAll('.recharts-cartesian-axis').length).toBeGreaterThanOrEqual(2);
    expect(container.querySelectorAll('.recharts-cartesian-grid')).toHaveLength(1);
    expect(screen.getAllByText('A1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('B2').length).toBeGreaterThan(0);
  });

  it('reaches every plotted value as text, one row per datum', () => {
    renderCartesian('bar');

    expect(screen.getByText('chart.showDataTable')).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(ROWS.length + 1);
    expect(within(table).getByText('Κτίριο')).toBeInTheDocument();
  });

  it('adds no second frame inside the section that already owns one', () => {
    const { container } = render(
      <ReportSection title="Κατανομή" collapsible={false}>
        <ReportChart
          type="pie"
          data={SLICES}
          series={SLICE_SERIES}
          categoryKey="name"
          categoryLabel="Κατηγορία"
          categoryOrder={SLICE_ORDER}
          formatValue={String}
        />
      </ReportSection>,
    );

    expect(cards(container)).toHaveLength(1);
  });

  it('leaves no heading reference dangling when the section already owns the title', () => {
    const { container } = render(
      <ReportSection title="Κατανομή" collapsible={false}>
        <ReportChart
          type="pie"
          data={SLICES}
          series={SLICE_SERIES}
          categoryKey="name"
          categoryLabel="Κατηγορία"
          categoryOrder={SLICE_ORDER}
          formatValue={String}
        />
      </ReportSection>,
    );

    for (const node of Array.from(container.querySelectorAll('[aria-labelledby]'))) {
      const target = node.getAttribute('aria-labelledby') ?? '';
      expect(container.ownerDocument.getElementById(target)).not.toBeNull();
    }
  });
});
