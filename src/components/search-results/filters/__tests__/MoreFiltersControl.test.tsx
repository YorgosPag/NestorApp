/**
 * 🔴 **«ΠΕΡΙΣΣΟΤΕΡΑ ΦΙΛΤΡΑ» — ΔΥΟ ΔΟΧΕΙΑ, ΕΝΑ ΚΟΥΜΠΙ** — άγκυρα του `MoreFiltersControl` (ADR-896 §7Α.7).
 *
 * Το jsdom **δεν έχει διάταξη**: εδώ κλειδώνεται η **απόφαση** (ποιο δοχείο σε ποιο πλάτος, τι
 * γράφει το κλείσιμο, τι μετρά το κουμπί), όχι η εμφάνιση — εκείνη μετριέται ζωντανά.
 * Συμπληρώνει τη Β του `PrimaryFilterBar.test`, που κοιτά μόνο το **κλειστό** δοχείο.
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import { EMPTY_LISTING_FILTERS, type ListingFilters } from '@/lib/listings/listing-filters';
import { EMPTY_LISTING_CRITERIA, withValues } from '@/lib/criteria/listing-criteria';
import { COLOR_BRIDGE } from '@/design-system/color-bridge';

import { countHiddenAsked, MoreFiltersControl } from '../MoreFiltersControl';
import type { FilterCommit } from '../use-filter-commit';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars === undefined ? key : `${key}#${JSON.stringify(vars)}`,
  }),
}));

jest.mock('@/lib/workspace/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

const NOOP_COMMIT: FilterCommit = {
  commit: jest.fn(),
  setRange: jest.fn(),
  setValues: jest.fn(),
  setFlag: jest.fn(),
  clearAxis: jest.fn(),
  clearAllCriteria: jest.fn(),
  setOrder: jest.fn(),
};

const ASKING: ListingFilters = {
  ...EMPTY_LISTING_FILTERS,
  criteria: withValues(EMPTY_LISTING_CRITERIA, 'offerKind', ['sell']),
};

function control(props: Partial<React.ComponentProps<typeof MoreFiltersControl>> = {}) {
  return render(
    <MoreFiltersControl filters={ASKING} listings={[]} commit={NOOP_COMMIT} visibleCount={7} viewport="wide" {...props} />,
  );
}

const MORE = { name: 'search-filters:filters.more' };

describe('Θ1 — ΣΤΕΝΗ: φύλλο με ρητό «Δείξε N»', () => {
  it('🔴 ανοίγει ως διάλογος με τίτλο, και το «Δείξε 7» τον κλείνει', () => {
    control({ viewport: 'narrow' });
    fireEvent.click(screen.getByRole('button', MORE));
    const sheet = screen.getByRole('dialog');
    expect(sheet).toHaveTextContent('search-filters:filters.heading');
    const apply = screen.getByRole('button', { name: 'search-filters:filters.apply#{"count":7}' });
    fireEvent.click(apply);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('Θ2 — ΕΥΡΕΙΑ και `measuring`: αναδυόμενο, ΚΑΝΕΝΑ «Δείξε N»', () => {
  it.each(['wide', 'measuring'] as const)('🔴 %s ⇒ αναδυόμενο χωρίς ρητό κλείσιμο', (viewport) => {
    // Τα αποτελέσματα αλλάζουν ΠΙΣΩ από το πάνελ — ένα «εφαρμογή» εδώ θα ήταν ψέμα.
    control({ viewport });
    fireEvent.click(screen.getByRole('button', MORE));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByText(/filters\.apply/)).not.toBeInTheDocument();
  });
});

describe('Θ3 — ΕΝΑ κουμπί, ίδιο σε κάθε κατάσταση', () => {
  it.each(['measuring', 'narrow', 'wide'] as const)('%s ⇒ ακριβώς ένα κουμπί, κλειστό δοχείο', (viewport) => {
    control({ viewport });
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByRole('button', MORE)).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('Θ4 — §8.80: ο αριθμός μετρά ΜΟΝΟ τα κρυμμένα', () => {
  it('🔴 «Πώληση» είναι ήδη τσιπ ⇒ 0· «Μπάνια» είναι κρυμμένο ⇒ 1', () => {
    expect(countHiddenAsked(ASKING.criteria)).toBe(0);
    const withHidden = { ...ASKING.criteria, bathrooms: { min: 1, max: null } };
    expect(countHiddenAsked(withHidden)).toBe(1);
    control({ filters: { ...ASKING, criteria: withHidden } });
    expect(screen.getByRole('button', { name: 'search-filters:filters.moreActive#{"count":1}' })).toHaveTextContent('1');
  });
});

/**
 * ADR-896 §7Α.8 — τα ευρήματα του στενού (στιγμιότυπα Giorgio): «Φίλτρα» δύο φορές στο φύλλο,
 * και «Δείξε N» αόρατο στο σκοτεινό (`bg-primary` ≡ `--card`).
 */
describe('Θ5 — ΕΝΑΣ τίτλος στο φύλλο, και είναι το όνομα του διαλόγου', () => {
  it('🔴 ακριβώς ένα «Φίλτρα», και το `aria-labelledby` του διαλόγου δείχνει σε αυτό', () => {
    control({ viewport: 'narrow' });
    fireEvent.click(screen.getByRole('button', MORE));
    const titles = screen.getAllByText('search-filters:filters.heading');
    expect(titles).toHaveLength(1);
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-labelledby', titles[0].id);
  });

  it('🔴 το αναδυόμενο κρατά τον δικό του ορατό τίτλο (h2)', () => {
    control({ viewport: 'wide' });
    fireEvent.click(screen.getByRole('button', MORE));
    expect(screen.getByRole('heading', { name: 'search-filters:filters.heading' })).toBeInTheDocument();
  });
});

describe('Θ6 — καμία προειδοποίηση Radix για τίτλο/περιγραφή', () => {
  it('🔴 το άνοιγμα του φύλλου δεν γράφει τίποτα στην κονσόλα', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    control({ viewport: 'narrow' });
    fireEvent.click(screen.getByRole('button', MORE));
    const said = [...warn.mock.calls, ...error.mock.calls].map((args) => String(args[0]));
    warn.mockRestore();
    error.mockRestore();
    expect(said.filter((m) => /Description|DialogTitle|aria-describedby/.test(m))).toEqual([]);
  });
});

describe('Θ7 — η κύρια ενέργεια από το SSoT, όχι `bg-primary`', () => {
  it('🔴 το «Δείξε N» φέρει το `COLOR_BRIDGE.action.primary`', () => {
    control({ viewport: 'narrow' });
    fireEvent.click(screen.getByRole('button', MORE));
    const apply = screen.getByRole('button', { name: 'search-filters:filters.apply#{"count":7}' });
    for (const cls of COLOR_BRIDGE.action.primary.split(' ')) expect(apply).toHaveClass(cls);
    expect(apply).not.toHaveClass('bg-primary');
  });
});
