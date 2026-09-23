/**
 * @fileoverview ΑΓΚΥΡΑ — **η παρουσίαση των στατιστικών αγγελίας** (ADR-777 §8.72 Φάση 2).
 * @related components/owner-property/{OwnerPropertyStatsRow, OwnerPropertyStatsPanel, OwnerPropertyPriceSteps}.tsx
 *
 * Με πραγματικούς loaders + ICU (`test-utils/real-i18n`):
 *   Κ1 · κάρτα: προβολές 7 ημ. + τάση + επαφές + ημέρες στην αγορά, με κείμενο (όχι μόνο εικονίδιο).
 *   Κ2 · άγνωστο ≠ μηδέν: βλάβη επαφών ⇒ «μη διαθέσιμες», ΠΟΤΕ «0 επαφές»· αποτυχία fetch ⇒ «δεν φορτώθηκαν».
 *   Κ3 · νέα μέτρηση ⇒ «Νέα μέτρηση», ΚΑΝΕΝΑ ποσοστό· `absent` ⇒ τίποτα.
 *   Π1 · πίνακας: «Μετράμε από …» · ο λόγος με λίγες προβολές λέει τους αριθμούς, όχι «0».
 *   Π2 · το εύρος 30 → 90 αλλάζει ΚΑΙ τους δείκτες ΚΑΙ τις ημέρες του γραφήματος.
 *   Π3 · εξέλιξη τιμής: νεότερο πρώτο, μείωση με ποσοστό, «Αποσύρθηκε» χωρίς ψεύτικο ποσό.
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
    ...over,
  };
}

function ready(s: ListingStatsSummary): ListingStatsState {
  return { state: 'ready', summary: s, today: TODAY };
}

function renderWithI18n(node: React.ReactNode) {
  return render(<I18nextProvider i18n={instance}>{node}</I18nextProvider>);
}

describe('Κ — η γραμμή της κάρτας', () => {
  it('Κ1 · προβολές + τάση + επαφές + ημέρες, σε λέξεις', () => {
    renderWithI18n(<OwnerPropertyStatsRow stats={ready(summary())} listedAt={LISTED} priceReduction={null} />);
    const row = screen.getByRole('list', { name: 'Στατιστικά αγγελίας' });
    expect(within(row).getByText('70 προβολές σε 7 ημέρες')).toBeInTheDocument();
    expect(within(row).getByText(/^\+40\s?% από την προηγούμενη εβδομάδα$/)).toBeInTheDocument();
    expect(within(row).getByText('3 επαφές')).toBeInTheDocument();
    expect(within(row).getByText(/ημέρες στην αγορά$/)).toBeInTheDocument();
  });

  it('Κ2 · βλάβη επαφών ⇒ «μη διαθέσιμες», ποτέ «0 επαφές»', () => {
    renderWithI18n(<OwnerPropertyStatsRow stats={ready(summary({ contacts: null }))} listedAt={LISTED} priceReduction={null} />);
    expect(screen.getByText('Επαφές: μη διαθέσιμες')).toBeInTheDocument();
    expect(screen.queryByText(/0 επαφές/)).not.toBeInTheDocument();
  });

  it('Κ2 · αποτυχία fetch ⇒ «δεν φορτώθηκαν», κανένας αριθμός', () => {
    renderWithI18n(<OwnerPropertyStatsRow stats={{ state: 'unavailable' }} listedAt={LISTED} priceReduction={null} />);
    expect(screen.getByText(/Τα στατιστικά δεν φορτώθηκαν/)).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('Κ3 · νέα μέτρηση ⇒ καμία ποσοστιαία τάση', () => {
    renderWithI18n(
      <OwnerPropertyStatsRow stats={ready(summary({ countingSince: '2026-10-18' }))} listedAt={LISTED} priceReduction={null} />,
    );
    expect(screen.getByText(/^Νέα μέτρηση/)).toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
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
    fireEvent.click(screen.getByRole('button', { name: '90 ημέρες' }));
    expect(screen.getByTestId('stats-chart')).toHaveTextContent('90:3');
    expect(screen.getByRole('button', { name: '90 ημέρες' })).toHaveAttribute('aria-pressed', 'true');
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

  it('Π · βλάβη προβολών ⇒ κανένα γράφημα, μήνυμα «δεν φορτώθηκαν»', () => {
    renderWithI18n(<OwnerPropertyStatsPanel stats={ready(summary({ views: null }))} listedAt={LISTED} priceHistory={[]} />);
    expect(screen.queryByTestId('stats-chart')).not.toBeInTheDocument();
    expect(screen.getByText(/Τα στατιστικά δεν φορτώθηκαν/)).toBeInTheDocument();
  });
});
