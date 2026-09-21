/**
 * ADR-598 G11 — axe στο κέλυφος γραφήματος (ADR-710), σε κάθε κατάσταση που βλέπει ο άνθρωπος.
 *
 * Το κέλυφος υπόσχεται τρία πράγματα προσβασιμότητας που καμία σάρωση στο mount δεν ελέγχει:
 * (1) ο πίνακας δεδομένων είναι το **κειμενικό ισοδύναμο** του γραφήματος (WCAG 1.1.1) — άρα
 * σαρώνεται **ανοιχτός**, με τις επεξηγήσεις στις κεφαλίδες του· (2) ο τίτλος ονομάζει την
 * περιοχή και κάθεται στο **σωστό επίπεδο** — άρα σαρώνεται και εμφωλευμένο (`ChartPlot` σε
 * κέλυφος που ήδη ξόδεψε το `h3`) με ενεργό `heading-order`· (3) η φόρμα καταχώρισης
 * ανακοινώνει την αναμονή — άρα σαρώνεται και σε `pending`.
 *
 * Το γράφημα αυτό καθαυτό (τα σημάδια του recharts) δεν είναι του κελύφους: στο jsdom το
 * `ResponsiveContainer` μετρά 0×0 και δεν ζωγραφίζει, γι' αυτό η θέση του είναι ένα `<svg>`.
 */

import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { expectNoA11yViolations, HEADING_OUTLINE_RULES } from '@/test-utils/a11y';
import { TooltipProvider } from '@/components/ui/tooltip';
import { SurfaceBoundary } from '@/components/ui/surface-context';

import { ChartCard } from '../ChartCard';
import { ChartPlot } from '../ChartPlot';
import { ChartCardHeader } from '../ChartCardHeader';
import { ChartCardFigure } from '../ChartCardFigure';
import { ChartCardDataTable } from '../ChartCardDataTable';
import { ChartCardSummary, ChartCardSummaryItem } from '../ChartCardSummary';
import { ChartCardTooltip } from '../ChartCardTooltip';
import { ChartCardEditor } from '../editor/ChartCardEditor';
import type { ChartSeries } from '../chart-card-series';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'el' } }),
}));

// =============================================================================
// FIXTURES
// =============================================================================

interface Point {
  year: number;
  construction: number;
  mortgage: number | null;
}

const DATA: Point[] = [
  { year: 2026, construction: 100, mortgage: 50 },
  { year: 2027, construction: 200, mortgage: null },
];

const TWO_SERIES: ChartSeries<Point>[] = [
  { key: 'construction', label: 'Κατασκευαστικό', description: 'Δάνειο ανέγερσης' },
  { key: 'mortgage', label: 'Στεγαστικό' },
];

/** Στην εφαρμογή τον παρέχει το `(app)/layout` — οι επεξηγήσεις κεφαλίδων τον απαιτούν. */
function renderWithTooltips(ui: React.ReactElement) {
  return render(<TooltipProvider delayDuration={0}>{ui}</TooltipProvider>);
}

function Plot() {
  return <svg aria-hidden="true" data-testid="plot" />;
}

function FullCard({ data = DATA, series = TWO_SERIES }: { data?: Point[]; series?: ChartSeries<Point>[] }) {
  return (
    <TooltipProvider delayDuration={0}>
      <ChartCard
        series={series}
        data={data}
        categoryKey="year"
        categoryLabel="Έτος"
        categoryDescription="Έτος λήξης της δόσης"
        formatValue={(value) => `€${value}`}
      >
        <ChartCardHeader title="Λήξεις δανείων">
          <button type="button">Εξαγωγή</button>
        </ChartCardHeader>
        <ChartCardSummary>
          <ChartCardSummaryItem label="Σύνολο" value="€350" />
          <ChartCardSummaryItem label="Μεταβολή" value="−€20" tone="bad" />
        </ChartCardSummary>
        <ChartCardFigure emptyMessage="Δεν υπάρχουν λήξεις" caption="Ποσά ανά έτος λήξης">
          <Plot />
        </ChartCardFigure>
      </ChartCard>
    </TooltipProvider>
  );
}

// =============================================================================
// ΚΕΛΥΦΟΣ — πλήρες · πίνακας ανοιχτός · κενό · μία σειρά · χρώμα ανά κατηγορία
// =============================================================================

describe('ChartCard a11y', () => {
  it('πλήρης κάρτα: τίτλος + ενέργεια, σύνοψη, γράφημα με λεζάντα και υπόμνημα, πίνακας κλειστός', async () => {
    const { container } = render(<FullCard />);
    expect(screen.getByRole('region', { name: 'Λήξεις δανείων' })).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it('ο πίνακας δεδομένων ανοιχτός — το κειμενικό ισοδύναμο, με επεξηγήσεις και κενά σημεία', async () => {
    const user = userEvent.setup();
    const { container } = render(<FullCard />);

    await user.click(screen.getByText('chart.showDataTable'));
    expect(screen.getByRole('table')).toBeVisible();
    expect(screen.getByRole('rowheader', { name: '2027' })).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it('η επεξήγηση κεφαλίδας ανοίγει με το πληκτρολόγιο και σαρώνεται ανοιχτή', async () => {
    const user = userEvent.setup();
    render(<FullCard />);
    await user.click(screen.getByText('chart.showDataTable'));

    screen.getByRole('button', { name: 'Κατασκευαστικό' }).focus();
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Δάνειο ανέγερσης');
    await expectNoA11yViolations(document.body);
  });

  it('ο πίνακας μόνος του, χωρίς λεζάντα γραφήματος: γενική λεζάντα, ποτέ ανώνυμος πίνακας', async () => {
    const user = userEvent.setup();
    const { container } = renderWithTooltips(
      <ChartCard series={TWO_SERIES} data={DATA} categoryKey="year" categoryLabel="Έτος" formatValue={(v) => `€${v}`}>
        <ChartCardHeader title="Λήξεις δανείων" />
        <ChartCardDataTable />
      </ChartCard>,
    );
    await user.click(screen.getByText('chart.showDataTable'));
    expect(screen.getByRole('table', { name: 'chart.dataTableCaption' })).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it('κενά δεδομένα: μήνυμα στη θέση του γραφήματος, χωρίς πίνακα', async () => {
    const { container } = render(<FullCard data={[]} />);
    expect(screen.getByText('Δεν υπάρχουν λήξεις')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it('μία σειρά: χωρίς υπόμνημα', async () => {
    const { container } = render(<FullCard series={[TWO_SERIES[0]]} />);
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it('χρώμα ανά κατηγορία (πίτα): το υπόμνημα ονομάζει τις κατηγορίες', async () => {
    const shares = [
      { phase: 'foundation', amount: 40 },
      { phase: 'frame', amount: 60 },
    ];
    const { container } = render(
      <ChartCard
        series={[{ key: 'amount', label: 'Ποσό' }]}
        data={shares}
        categoryKey="phase"
        categoryLabel="Φάση"
        categoryOrder={['foundation', 'frame', 'finishes']}
        formatCategory={(value) => (value === 'foundation' ? 'Θεμελίωση' : 'Φέρων οργανισμός')}
        formatValue={(value) => `${value}%`}
      >
        <ChartCardHeader title="Κατανομή κόστους" />
        <ChartCardFigure emptyMessage="—">
          <Plot />
        </ChartCardFigure>
      </ChartCard>,
    );
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Θεμελίωση', 'Φέρων οργανισμός']);
    await expectNoA11yViolations(container);
  });

  it('το αναδυόμενο πάνω από στήλη (tooltip του recharts)', async () => {
    const { container } = renderWithTooltips(
      <ChartCard series={TWO_SERIES} data={DATA} categoryKey="year" categoryLabel="Έτος" formatValue={(v) => `€${v}`}>
        <ChartCardHeader title="Λήξεις δανείων" />
        <ChartCardFigure emptyMessage="—">
          <ChartCardTooltip
            active
            label={2026}
            payload={[
              { dataKey: 'construction', name: 'construction', value: 100, color: '#000', payload: DATA[0] },
              { dataKey: 'mortgage', name: 'mortgage', value: 50, color: '#111', payload: DATA[0] },
            ]}
          />
        </ChartCardFigure>
      </ChartCard>,
    );
    expect(container.querySelector('.recharts-tooltip-wrapper')).toHaveTextContent('€100');
    await expectNoA11yViolations(container);
  });
});

// =============================================================================
// ChartPlot — χωρίς πλαίσιο, μέσα σε κέλυφος που ήδη ξόδεψε το h3
// =============================================================================

describe('ChartPlot a11y — το επίπεδο επικεφαλίδας', () => {
  function ReportSectionLike({ children }: { readonly children: React.ReactNode }) {
    return (
      <section aria-labelledby="report-title">
        <h3 id="report-title">Χρηματοδότηση</h3>
        <SurfaceBoundary>{children}</SurfaceBoundary>
      </section>
    );
  }

  it('με δικό του τίτλο: h4 κάτω από το h3 της ενότητας, outline άθικτο', async () => {
    const { container } = renderWithTooltips(
      <main>
        <h1>Έργο</h1>
        <h2>Αναφορές</h2>
        <ReportSectionLike>
          <ChartPlot series={TWO_SERIES} data={DATA} categoryKey="year" categoryLabel="Έτος" formatValue={(v) => `€${v}`}>
            <ChartPlot.Header title="Λήξεις δανείων" />
            <ChartPlot.Figure emptyMessage="—">
              <Plot />
            </ChartPlot.Figure>
          </ChartPlot>
        </ReportSectionLike>
      </main>,
    );
    expect(screen.getByRole('heading', { name: 'Λήξεις δανείων' }).tagName).toBe('H4');
    await expectNoA11yViolations(container, HEADING_OUTLINE_RULES);
  });

  it('χωρίς τίτλο: καμία κρεμασμένη αναφορά aria-labelledby', async () => {
    const { container } = renderWithTooltips(
      <ReportSectionLike>
        <ChartPlot series={TWO_SERIES} data={DATA} categoryKey="year" categoryLabel="Έτος" formatValue={(v) => `€${v}`}>
          <ChartPlot.Figure emptyMessage="—">
            <Plot />
          </ChartPlot.Figure>
        </ChartPlot>
      </ReportSectionLike>,
    );
    expect(container.querySelectorAll('section')[1]).not.toHaveAttribute('aria-labelledby');
    await expectNoA11yViolations(container);
  });
});

// =============================================================================
// ChartCardEditor — κλειστή αποκάλυψη · ανοιχτό πλέγμα · λίστα γραμμών · σε αναμονή
// =============================================================================

describe('ChartCardEditor a11y', () => {
  function SingleRecordForm({ pending = false }: { readonly pending?: boolean }) {
    return (
      <ChartCardEditor>
        <ChartCardEditor.Disclosure triggerLabel="Προσθήκη λήξης">
          {(close) => (
            <ChartCardEditor.Grid>
              <ChartCardEditor.Field>
                <label htmlFor="due-year">Έτος</label>
                <input id="due-year" type="text" inputMode="numeric" defaultValue="2028" />
              </ChartCardEditor.Field>
              <ChartCardEditor.Field>
                <label htmlFor="due-amount">Ποσό</label>
                <input id="due-amount" type="text" inputMode="decimal" />
              </ChartCardEditor.Field>
              <ChartCardEditor.Actions className="col-span-2">
                <ChartCardEditor.Submit label="Αποθήκευση" pending={pending} onClick={jest.fn()} />
                <ChartCardEditor.Cancel label="Άκυρο" onClick={close} />
              </ChartCardEditor.Actions>
            </ChartCardEditor.Grid>
          )}
        </ChartCardEditor.Disclosure>
      </ChartCardEditor>
    );
  }

  it('αποκάλυψη κλειστή', async () => {
    await expectNoA11yViolations(<SingleRecordForm />);
  });

  it.each([
    ['έτοιμη', false],
    ['σε αναμονή (disabled + aria-busy)', true],
  ])('φόρμα ανοιχτή — %s', async (_state, pending) => {
    const user = userEvent.setup();
    const { container } = render(<SingleRecordForm pending={pending} />);
    await user.click(screen.getByRole('button', { name: 'Προσθήκη λήξης' }));

    const submit = screen.getByRole('button', { name: pending ? 'chart.saving' : 'Αποθήκευση' });
    expect(submit).toHaveAttribute('aria-busy', String(pending));
    await expectNoA11yViolations(container);
  });

  it('λίστα γραμμών: κάθε κουμπί αφαίρεσης λέει ΤΙ αφαιρεί', async () => {
    const rows = ['Θεμελίωση', 'Σκελετός'];
    const { container } = render(
      <ChartCardEditor>
        <ChartCardEditor.Rows>
          <ChartCardEditor.RowHeader>
            <span className="col-span-5">Κατηγορία</span>
            <span className="col-span-5">Προϋπολογισμός</span>
          </ChartCardEditor.RowHeader>
          {rows.map((row) => (
            <ChartCardEditor.Row key={row}>
              <input aria-label="Κατηγορία" className="col-span-5" defaultValue={row} />
              <input aria-label="Προϋπολογισμός" className="col-span-5" defaultValue="1000" />
              <ChartCardEditor.Remove label={`Αφαίρεση γραμμής: ${row}`} onClick={jest.fn()} />
            </ChartCardEditor.Row>
          ))}
          <ChartCardEditor.AddRow label="Προσθήκη γραμμής" onClick={jest.fn()} />
        </ChartCardEditor.Rows>
      </ChartCardEditor>,
    );
    expect(screen.getByRole('button', { name: 'Αφαίρεση γραμμής: Σκελετός' })).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });
});
