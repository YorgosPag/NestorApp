/**
 * @fileoverview ΑΓΚΥΡΑ — **η παρουσίαση των στατιστικών αγγελίας** (ADR-777 §8.72 Φάση 2).
 * @related components/owner-property/{OwnerPropertyStatsRow, OwnerPropertyStatsPanel, OwnerPropertyPriceSteps}.tsx
 *
 * Με πραγματικούς loaders + ICU (`test-utils/real-i18n`):
 *   Κ1 · κάρτα (πλακίδια §8.74.7): προβολές 7 ημ. + τάση + επαφές + αποθηκεύσεις + ημέρες, όρος + τιμή.
 *   Κ2 · άγνωστο ≠ μηδέν: βλάβη επαφών ⇒ «—» + «μη διαθέσιμο», ΠΟΤΕ «0»· αποτυχία fetch ⇒ «δεν φορτώθηκαν».
 *   Κ3 · νέα μέτρηση ⇒ ΚΑΝΕΝΑ ποσοστό, και οι προβολές λένε τις ΜΕΤΡΗΜΕΝΕΣ ημέρες· `absent` ⇒ τίποτα.
 *   Κ4 · πριν αρχίσει η μέτρηση ⇒ «—» + «Μετράμε από …», ΠΟΤΕ «0», καμία τάση (§8.72.8).
 *   Κ6 · σκελετός = φόρτωση = βλάβη = τιμές σε γεωμετρία ⇒ CLS 0 εκ κατασκευής (§8.74.7, μετρημένο 0,0012 πριν).
 *   Π1 · πίνακας: «Μετράμε από …» · ο λόγος με λίγες προβολές λέει τους αριθμούς, όχι «0».
 *   Π2 · το εύρος 30 → 90 αλλάζει ΚΑΙ τους δείκτες ΚΑΙ τις ημέρες του γραφήματος.
 *   Π3 · εξέλιξη τιμής: νεότερο πρώτο, μείωση με ποσοστό, «Αποσύρθηκε» χωρίς ψεύτικο ποσό.
 *   Π4 · πριν αρχίσει η μέτρηση ο δείκτης προβολών λέει παύλα, όχι «0 · Τελευταίες 30 ημέρες».
 *   Π5 · το πατημένο εύρος φορά τον ρόλο χειριστηρίου επιλογής (ADR-770 §17), όχι `bg-primary` ≡ `--card`.
 */

import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { i18n } from 'i18next';
import { I18nextProvider } from 'react-i18next';

import { createRealI18n } from '@/test-utils/real-i18n';
import type { ListingStatsSummary } from '@/lib/listings/listing-stats';
import type { ListingStatsState } from '@/hooks/owner-property/useOwnerPortfolioStats';
import type { ListedAt } from '@/types/public-listing';

import { OwnerPropertyStatsRow } from '../OwnerPropertyStatsRow';
import { OwnerPropertyStatsPanel } from '../OwnerPropertyStatsPanel';
import { CARD_KPI_COUNT, CARD_KPI_GRID, StatsRowPending } from '../owner-property-stats-pending';

jest.mock('@/i18n/hooks/useTranslation', () => {
  const reactI18next = jest.requireActual('react-i18next');
  return {
    useTranslation: (ns: readonly string[]) => {
      const result = reactI18next.useTranslation(ns as string[]);
      return { ...result, isNamespaceReady: true };
    },
  };
});

// Το recharts δεν έχει διάταξη στο jsdom: το γράφημα αποδίδεται ως δηλωμένο στέλεχος με τις ημέρες του.
jest.mock('next/dynamic', () => () =>
  function ChartStub(props: { days: readonly { day: string }[]; events: readonly unknown[] }) {
    return <p data-testid="stats-chart">{`${props.days.length}:${props.events.length}`}</p>;
  },
);

const TODAY = '2026-10-20';
const LISTED: ListedAt = { kind: 'known', at: '2026-10-02T09:00:00.000Z' };

let instance: i18n;
beforeAll(async () => {
  instance = await createRealI18n(['property-market', 'common']);
});

function summary(over: Partial<ListingStatsSummary> = {}): ListingStatsSummary {
  return {
    propertyId: 'ownp_1',
    countingSince: '2026-09-24',
    views: { lastWindow: 70, previousWindow: 50, total: 120, daily: { '2026-10-19': 40, '2026-10-20': 30 } },
    contacts: { total: 3, lastWindow: 1, daily: { '2026-10-20': 1 } },
    saves: { total: 5, lastWindow: 2, daily: { '2026-09-01': 3, '2026-10-20': 2 } },
    ...over,
  };
}

function ready(s: ListingStatsSummary): ListingStatsState {
  return { state: 'ready', summary: s, today: TODAY };
}

function renderWithI18n(node: React.ReactNode) {
  return render(<I18nextProvider i18n={instance}>{node}</I18nextProvider>);
}

/** Το πλακίδιο ενός δείκτη, από τον όρο του — όπως το διαβάζει ο άνθρωπος. */
function tile(label: string): HTMLElement {
  const region = screen.getByRole('region', { name: 'Στατιστικά αγγελίας' });
  const term = within(region).getByText(label);
  const dl = term.closest('dl');
  if (dl === null) throw new Error(`Κανένα πλακίδιο για «${label}»`);
  return dl;
}

/** Το δηλωμένο ύψος μιας γραμμής πλακιδίου (`h-N`) — η γεωμετρία που κρατά το CLS στο 0. */
function heightOf(line: Element): string {
  return Array.from(line.classList).find((name) => /^h-\d+$/.test(name)) ?? '?';
}

describe('Κ — τα πλακίδια της κάρτας (§8.74.7)', () => {
  it('Κ1 · προβολές + τάση + επαφές + αποθηκεύσεις + ημέρες, με όρο και τιμή', () => {
    renderWithI18n(<OwnerPropertyStatsRow stats={ready(summary())} listedAt={LISTED} priceReduction={null} />);
    expect(within(tile('Προβολές')).getByText('70')).toBeInTheDocument();
    expect(within(tile('Προβολές')).getByText('Τελευταίες 7 ημέρες')).toBeInTheDocument();
    // Συμπαγής τάση για το μάτι + ολόκληρη πρόταση για τον αναγνώστη οθόνης.
    expect(within(tile('Προβολές')).getByText(/^\+40\s?%$/)).toBeInTheDocument();
    expect(within(tile('Προβολές')).getByText(/^\+40\s?% από την προηγούμενη εβδομάδα$/)).toHaveClass('sr-only');
    expect(within(tile('Επαφές')).getByText('1')).toBeInTheDocument();
    expect(within(tile('Ημέρες στην αγορά')).queryByText('—')).not.toBeInTheDocument();
  });

  it('Κ2 · βλάβη επαφών ⇒ «—» + «μη διαθέσιμο», ποτέ «0»', () => {
    renderWithI18n(<OwnerPropertyStatsRow stats={ready(summary({ contacts: null }))} listedAt={LISTED} priceReduction={null} />);
    expect(within(tile('Επαφές')).getByText('—')).toBeInTheDocument();
    expect(within(tile('Επαφές')).getByText('μη διαθέσιμο')).toBeInTheDocument();
    expect(within(tile('Επαφές')).queryByText('0')).not.toBeInTheDocument();
  });

  it('Κ2 · αποτυχία fetch ⇒ «δεν φορτώθηκαν», κανένας αριθμός — αλλά οι ημέρες στην αγορά μένουν', () => {
    renderWithI18n(<OwnerPropertyStatsRow stats={{ state: 'unavailable' }} listedAt={LISTED} priceReduction={null} />);
    expect(screen.getByText(/Τα στατιστικά δεν φορτώθηκαν/)).toBeInTheDocument();
    for (const label of ['Προβολές', 'Επαφές', 'Αποθηκεύσεις']) {
      expect(within(tile(label)).getByText('—')).toBeInTheDocument();
    }
    expect(within(tile('Ημέρες στην αγορά')).queryByText('—')).not.toBeInTheDocument();
  });

  it('Κ3 · νέα μέτρηση ⇒ ΚΑΝΕΝΑ ποσοστό, και οι προβολές λένε τις ΜΕΤΡΗΜΕΝΕΣ ημέρες', () => {
    renderWithI18n(
      <OwnerPropertyStatsRow stats={ready(summary({ countingSince: '2026-10-18' }))} listedAt={LISTED} priceReduction={null} />,
    );
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    expect(within(tile('Προβολές')).getByText('70')).toBeInTheDocument();
    expect(within(tile('Προβολές')).getByText('Σε 3 ημέρες μέτρησης')).toBeInTheDocument();
  });

  it('Κ4 · πριν αρχίσει η μέτρηση ⇒ «—» + «Μετράμε από», κανένα «0», καμία τάση', () => {
    renderWithI18n(
      <OwnerPropertyStatsRow stats={ready(summary({ countingSince: '2026-10-21' }))} listedAt={LISTED} priceReduction={null} />,
    );
    expect(within(tile('Προβολές')).getByText('—')).toBeInTheDocument();
    expect(within(tile('Προβολές')).getByText(/^Μετράμε από/)).toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it('Κ5 · αποθηκεύσεις (§8.74): πλήθος + νέες · βλάβη ⇒ «—», ποτέ «0», και οι άλλες πηγές φαίνονται', () => {
    const { unmount } = renderWithI18n(<OwnerPropertyStatsRow stats={ready(summary())} listedAt={LISTED} priceReduction={null} />);
    expect(within(tile('Αποθηκεύσεις')).getByText('5')).toBeInTheDocument();
    expect(within(tile('Αποθηκεύσεις')).getByText('2 νέες τις τελευταίες 7 ημέρες')).toBeInTheDocument();
    unmount();
    renderWithI18n(<OwnerPropertyStatsRow stats={ready(summary({ saves: null }))} listedAt={LISTED} priceReduction={null} />);
    expect(within(tile('Αποθηκεύσεις')).getByText('—')).toBeInTheDocument();
    expect(within(tile('Αποθηκεύσεις')).queryByText('0')).not.toBeInTheDocument();
    expect(within(tile('Επαφές')).getByText('1')).toBeInTheDocument();
  });

  /**
   * 🔴 **CLS 0 ΕΚ ΚΑΤΑΣΚΕΥΗΣ** — μετρημένο 0,0012 σε browser όταν ο σκελετός ήταν μία γραμμή και οι τιμές τρεις.
   * Το jsdom δεν έχει διάταξη, άρα ρωτάμε τη **γεωμετρία ως δήλωση**: ίδιο πλέγμα, ίδιος αριθμός πλακιδίων,
   * ίδια κλάση ύψους σε κάθε γραμμή — σε σκελετό, φόρτωση, βλάβη και τιμές.
   */
  it('Κ6 · σκελετός, φόρτωση, βλάβη και τιμές έχουν ΤΗΝ ΙΔΙΑ γεωμετρία', () => {
    const shapeOf = (root: HTMLElement): string => {
      const grid = root.querySelector(`[class="${CARD_KPI_GRID}"]`);
      if (grid === null) return 'no-grid';
      const tiles = Array.from(grid.children).filter((child) => !child.classList.contains('sr-only'));
      return tiles
        .map((tileEl) => Array.from(tileEl.children).map(heightOf).join('/'))
        .join(' | ');
    };
    const states: ListingStatsState[] = [{ state: 'loading' }, { state: 'unavailable' }, ready(summary()), ready(summary({ contacts: null, saves: null }))];
    const pending = render(<StatsRowPending />);
    const expected = shapeOf(pending.container);
    pending.unmount();
    expect(expected).toBe(Array.from({ length: CARD_KPI_COUNT }, () => 'h-4/h-6/h-4').join(' | '));
    for (const state of states) {
      const { container, unmount } = renderWithI18n(<OwnerPropertyStatsRow stats={state} listedAt={LISTED} priceReduction={null} />);
      expect(shapeOf(container)).toBe(expected);
      unmount();
    }
  });

  it('Κ3 · absent ⇒ τίποτα', () => {
    const { container } = renderWithI18n(
      <OwnerPropertyStatsRow stats={{ state: 'absent' }} listedAt={LISTED} priceReduction={null} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe('Π — ο πίνακας της λεπτομέρειας', () => {
  const history = [
    { at: '2026-08-01T09:00:00.000Z', price: { role: 'sale', amount: 300_000 } },
    { at: '2026-10-10T09:00:00.000Z', price: { role: 'sale', amount: 276_000 } },
    { at: '2026-10-12T09:00:00.000Z', price: null },
  ];

  it('Π1 · «Μετράμε από» + λόγος με λίγες προβολές λέει τους αριθμούς', () => {
    renderWithI18n(<OwnerPropertyStatsPanel stats={ready(summary())} listedAt={LISTED} priceHistory={[]} />);
    expect(screen.getByText(/^Μετράμε από/)).toBeInTheDocument();
    expect(screen.getByText('Λίγες προβολές ακόμη (70 από τις 100 που χρειάζεται ο δείκτης)')).toBeInTheDocument();
  });

  it('Π2 · 30 → 90 ημέρες: και οι ημέρες του γραφήματος και η ετικέτα των δεικτών', () => {
    renderWithI18n(<OwnerPropertyStatsPanel stats={ready(summary())} listedAt={LISTED} priceHistory={history} />);
    expect(screen.getByTestId('stats-chart')).toHaveTextContent('30:2');
    fireEvent.click(screen.getByRole('radio', { name: '90 ημέρες' }));
    expect(screen.getByTestId('stats-chart')).toHaveTextContent('90:3');
    expect(screen.getByRole('radio', { name: '90 ημέρες' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getAllByText('Τελευταίες 90 ημέρες').length).toBeGreaterThan(0);
  });

  it('Π3 · εξέλιξη τιμής: νεότερο πρώτο, μείωση −8%, απόσυρση χωρίς ποσό', () => {
    renderWithI18n(<OwnerPropertyStatsPanel stats={ready(summary())} listedAt={LISTED} priceHistory={history} />);
    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row').slice(1);
    expect(within(rows[0]).getByText('Αποσύρθηκε')).toBeInTheDocument();
    expect(within(rows[0]).getByText('Εκτός αγοράς')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Μείωση τιμής')).toBeInTheDocument();
    expect(within(rows[1]).getByText(/^−8\s?%$/)).toBeInTheDocument();
    expect(within(rows[2]).getByText('Καταχώριση')).toBeInTheDocument();
  });

  it('Π4 · πριν αρχίσει η μέτρηση ⇒ παύλα στις προβολές, οι επαφές μετριούνται κανονικά', () => {
    renderWithI18n(<OwnerPropertyStatsPanel stats={ready(summary({ countingSince: '2026-10-21' }))} listedAt={LISTED} priceHistory={[]} />);
    const viewsKpi = screen.getByText('Προβολές', { selector: 'dt' }).closest('dl') as HTMLElement;
    expect(within(viewsKpi).getByText('—')).toBeInTheDocument();
    expect(within(viewsKpi).getByText(/^Μετράμε από/)).toBeInTheDocument();
    const contactsKpi = screen.getByText('Επαφές', { selector: 'dt' }).closest('dl') as HTMLElement;
    expect(within(contactsKpi).getByText('1')).toBeInTheDocument();
  });

  it('Π5 · το πατημένο εύρος φορά τον ρόλο χειριστηρίου επιλογής — και δεν αδειάζει (ADR-770 §19)', () => {
    renderWithI18n(<OwnerPropertyStatsPanel stats={ready(summary())} listedAt={LISTED} priceHistory={[]} />);
    expect(screen.getByRole('group', { name: 'Εύρος γραφήματος' })).toBeInTheDocument();
    const pressed = screen.getByRole('radio', { name: '30 ημέρες' });
    expect(pressed).toHaveAttribute('data-state', 'on');
    expect(pressed).toHaveClass('data-[state=on]:bg-control-accent', 'data-[state=on]:text-control-accent-foreground');
    expect(pressed).not.toHaveClass('bg-primary');
    // Δεύτερο κλικ στο ήδη επιλεγμένο: το Radix θα το αποεπέλεγε — το primitive το αρνείται.
    fireEvent.click(pressed);
    expect(pressed).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('stats-chart')).toHaveTextContent('30:');
  });

  it('Π6 · 5ος δείκτης (§8.74): σύνολο που ισχύει σήμερα + «νέες» στο ΕΥΡΟΣ του γραφήματος', () => {
    renderWithI18n(<OwnerPropertyStatsPanel stats={ready(summary())} listedAt={LISTED} priceHistory={[]} />);
    const term = screen.getByText('Αποθηκεύσεις', { selector: 'dt' });
    const kpi = term.closest('dl') as HTMLElement;
    expect(within(kpi).getByText('5')).toBeInTheDocument();
    expect(within(kpi).getByText('2 νέες τις τελευταίες 30 ημέρες')).toBeInTheDocument();
  });

  it('Π · βλάβη προβολών ⇒ κανένα γράφημα, μήνυμα «δεν φορτώθηκαν»', () => {
    renderWithI18n(<OwnerPropertyStatsPanel stats={ready(summary({ views: null }))} listedAt={LISTED} priceHistory={[]} />);
    expect(screen.queryByTestId('stats-chart')).not.toBeInTheDocument();
    expect(screen.getByText(/Τα στατιστικά δεν φορτώθηκαν/)).toBeInTheDocument();
  });
});
