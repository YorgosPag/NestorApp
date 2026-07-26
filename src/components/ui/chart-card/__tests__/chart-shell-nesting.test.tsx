/**
 * ADR-710 §11 — the two levels of the chart shell, and the defect between them.
 *
 * ## What went wrong, and why a test rather than a note
 *
 * Two shells in this app each own a framed, titled section: `ReportSection` (58
 * consumers) and `ChartCard` (14). Both drew a `<Card>`; both hardcoded an `<h3>`.
 * Nesting one inside the other therefore produced a card inside a card **and** a heading
 * inside a heading — the second of which is invisible on screen and breaks the document
 * outline a screen-reader user navigates by (WCAG 1.3.1).
 *
 * Material 3, Polaris and Carbon all answer this with a sentence in their docs. A
 * sentence did not stop 30 of this domain's 34 charts from hand-picking colour slots
 * either. So the rule is a mechanism: `ChartCard` refuses to render inside a surface and
 * names `ChartPlot` as the fix, and the heading level is read from position instead of
 * typed in.
 *
 * These anchors exist because the failure mode is **silent**. A nested card renders
 * perfectly well; it just looks slightly wrong to a sighted reader and reads as a broken
 * outline to everyone else. Nothing throws, so nothing catches it.
 *
 * @see surface-context.tsx — why depth is context, and why the check throws
 * @see ChartPlot.tsx — why the frame is a level of composition, not a prop
 */

import * as React from 'react';
import { render, screen } from '@testing-library/react';

import { ChartCard } from '../ChartCard';
import { ChartPlot, CHART_SHELL_SLOTS } from '../ChartPlot';
import { SurfaceBoundary } from '@/components/ui/surface-context';
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

const SERIES: ChartSeries<Point>[] = [
  { key: 'construction', label: 'Construction' },
  { key: 'mortgage', label: 'Mortgage' },
];

/** Same declaration at either level — that is the point of the split. */
function shellBody(Shell: typeof ChartCard | typeof ChartPlot) {
  return (
    <Shell
      series={SERIES}
      data={DATA}
      categoryKey="year"
      categoryLabel="Year"
      formatValue={(value) => `€${value}`}
    >
      <Shell.Header title="Maturity" />
      <Shell.Figure emptyMessage="nothing here">
        <svg data-testid="plot" />
      </Shell.Figure>
    </Shell>
  );
}

/** Stands in for `ReportSection`: a shell that owns a frame and spends a heading. */
function FramedSection({ children }: { children: React.ReactNode }) {
  return (
    <div data-testid="outer-card">
      <h3>Section title</h3>
      <SurfaceBoundary>{children}</SurfaceBoundary>
    </div>
  );
}

interface RefusalBoundaryProps {
  readonly onError: (error: Error) => void;
  readonly children: React.ReactNode;
}

interface RefusalBoundaryState {
  readonly failed: boolean;
}

/** Catches the refusal so the assertion can read it. Renders nothing once it has. */
class RefusalBoundary extends React.Component<RefusalBoundaryProps, RefusalBoundaryState> {
  override state: RefusalBoundaryState = { failed: false };

  static getDerivedStateFromError(): RefusalBoundaryState {
    return { failed: true };
  }

  override componentDidCatch(error: Error): void {
    this.props.onError(error);
  }

  override render(): React.ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * Renders `ui` expecting the shell to refuse, and returns the error it threw.
 *
 * Not `expect(() => render(...)).toThrow()`. That is the React 18 idiom, and under React
 * 19 it is **permanently red**: an error thrown in render no longer escapes `render()`
 * synchronously — React routes it to the root's uncaught-error handler and `render`
 * returns normally, so the assertion reports failure whether the shell refuses or not.
 * A check that says the same thing in both states measures nothing (ADR-663). An error
 * boundary is the supported way to observe it, and it is how the running app sees it too.
 *
 * Mutation-verified: replacing the guard in `ChartCard` with `isNested = false` turns the
 * two anchors below red, naming exactly this — the shell rendered without refusing.
 */
function captureRefusal(ui: React.ReactElement): Error {
  // React logs the error on its way to the boundary; silence it so the run stays readable.
  const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  let captured: Error | null = null;

  render(
    <RefusalBoundary
      onError={(error) => {
        captured = error;
      }}
    >
      {ui}
    </RefusalBoundary>,
  );

  consoleError.mockRestore();

  if (captured === null) {
    throw new Error('Expected the shell to refuse to nest, but it rendered without error.');
  }
  return captured;
}

// =============================================================================
// 1 — THE REFUSAL
// =============================================================================

describe('ChartCard nesting refusal', () => {
  it('renders its own card at page level, exactly as before the split', () => {
    render(shellBody(ChartCard));

    expect(screen.getByTestId('plot')).toBeInTheDocument();
    // The accessible name still comes from the title, via aria-labelledby.
    expect(screen.getByRole('heading', { name: 'Maturity' })).toBeInTheDocument();
  });

  it('throws instead of drawing a second card inside a framed section', () => {
    const error = captureRefusal(<FramedSection>{shellBody(ChartCard)}</FramedSection>);

    expect(error.message).toMatch(/cannot be nested/i);
  });

  it('names ChartPlot in the message, so the throw is an instruction', () => {
    const error = captureRefusal(<FramedSection>{shellBody(ChartCard)}</FramedSection>);

    expect(error.message).toMatch(/<ChartPlot>/);
  });
});

// =============================================================================
// 2 — THE FRAMELESS LEVEL
// =============================================================================

describe('ChartPlot inside a framed section', () => {
  it('renders the same plot without adding a second card', () => {
    render(<FramedSection>{shellBody(ChartPlot)}</FramedSection>);

    expect(screen.getByTestId('plot')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Maturity' })).toBeInTheDocument();
  });

  it('titles itself one level below the section that already spent the h3', () => {
    render(<FramedSection>{shellBody(ChartPlot)}</FramedSection>);

    // The enclosing section owns the h3; the plot must not claim a second one.
    expect(screen.getByRole('heading', { name: 'Section title' }).tagName).toBe('H3');
    expect(screen.getByRole('heading', { name: 'Maturity' }).tagName).toBe('H4');
  });

  it('titles itself h3 at page level, where nothing has spent one', () => {
    render(shellBody(ChartPlot));

    expect(screen.getByRole('heading', { name: 'Maturity' }).tagName).toBe('H3');
  });

  it('still renders the data table — the frame was optional, the text equivalent is not', () => {
    render(<FramedSection>{shellBody(ChartPlot)}</FramedSection>);

    // Every series reaches the reader as a real table column, which is what the measured
    // palette owes (IBM Carbon holds the same rule: a chart without a data table is not
    // accessible, because a sub-1° pie slice reaches neither keyboard nor tooltip).
    expect(screen.getByRole('columnheader', { name: /Construction/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Mortgage/ })).toBeInTheDocument();
  });
});

// =============================================================================
// 3 — THE SPLIT MUST NOT BECOME TWO IMPLEMENTATIONS
// =============================================================================

describe('the two levels share one implementation', () => {
  it('hands both levels the identical slot object, not two equal lists', () => {
    // A second Object.assign with the same six entries is the sibling clone ADR-584
    // exists to catch — and jscpd cannot see it once the lists drift by one entry.
    for (const slot of Object.keys(CHART_SHELL_SLOTS)) {
      const key = slot as keyof typeof CHART_SHELL_SLOTS;
      expect(ChartCard[key]).toBe(ChartPlot[key]);
    }
  });

  it('exposes every slot on both, so a call site can move between them unchanged', () => {
    expect(Object.keys(CHART_SHELL_SLOTS).sort()).toEqual(
      ['Editor', 'Figure', 'Header', 'Summary', 'SummaryItem', 'Tooltip'].sort(),
    );
  });
});

// =============================================================================
// 4 — HEADING DEPTH HAS A FLOOR
// =============================================================================

describe('heading level', () => {
  it('clamps at h6 rather than emitting an invalid h7', () => {
    // Seven shells deep is a layout problem. Emitting <h7> would additionally break the
    // outline this module exists to protect, so the clamp is the lesser failure.
    render(
      <SurfaceBoundary>
        <SurfaceBoundary>
          <SurfaceBoundary>
            <SurfaceBoundary>
              <SurfaceBoundary>{shellBody(ChartPlot)}</SurfaceBoundary>
            </SurfaceBoundary>
          </SurfaceBoundary>
        </SurfaceBoundary>
      </SurfaceBoundary>,
    );

    expect(screen.getByRole('heading', { name: 'Maturity' }).tagName).toBe('H6');
  });
});
