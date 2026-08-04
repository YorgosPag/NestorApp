/**
 * 🔴 ADR-751 Φ8.γ — **η λίστα εντοπισμένων συνδέσμων** (μοτίβο VS Code).
 *
 * Τρία πράγματα κλειδώνονται, και κανένα δεν είναι «εμφανίζεται η λίστα»:
 *
 *  1. **Κενή λίστα δεν ανοίγει.** «Καμία διεύθυνση» δεν είναι ερώτηση — είναι σιωπή. Άδειο
 *     παράθυρο ως απάντηση σε συντόμευση διαβάζεται ως ελάττωμα.
 *  2. **«Δεν έχει» ≠ «δεν ταιριάζει».** Δύο διαφορετικά μηνύματα, γιατί απαντούν σε
 *     διαφορετικές ερωτήσεις του χρήστη: «λάθος πίνακας» εναντίον «λάθος αναζήτηση».
 *  3. **Η αναζήτηση κοιτά ΚΑΙ την κεφαλίδα στήλης.** Ο άνθρωπος πληκτρολογεί αυτό που
 *     διαβάζει στην οθόνη· φίλτρο μόνο στο κείμενο θα απαντούσε «κανένα» στο «E-mail».
 *
 * @see ui/components/TableLinkPicker.tsx
 */

import { act, fireEvent, render, screen } from '@testing-library/react';

jest.mock('@/i18n/hooks/useTranslation', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const el = require('../../../../../i18n/locales/el/dxf-viewer.json');
  const lookup = (key: string): unknown =>
    key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], el);
  return {
    useTranslation: () => ({
      t: (key: string, params?: Record<string, unknown>) => {
        const raw = lookup(key);
        if (typeof raw !== 'string') throw new Error(`ΛΕΙΠΕΙ κλειδί i18n: ${key}`);
        // Αρκετό για τα tests: ICU plural → το σκέτο πλήθος, απλή παρεμβολή για τα υπόλοιπα.
        return raw
          .replace(/\{(\w+), plural,[^}]*\}\}/gu, String(params?.count ?? ''))
          .replace(/\{(\w+)\}/gu, (_m, name: string) => String(params?.[name] ?? ''));
      },
    }),
  };
});

const openCellLink = jest.fn();
jest.mock('../../../bim/table/table-link-interaction-2d', () => ({
  openCellLink: (href: string) => openCellLink(href),
}));

import { TableLinkPicker } from '../TableLinkPicker';
import {
  closeTableLinkPicker,
  getTableLinkPicker,
  openTableLinkPicker,
} from '../../../state/table-link-picker-store';
import type { TableCellLinkEntry } from '../../../bim/table/table-cell-link-index';

function entry(over: Partial<TableCellLinkEntry> = {}): TableCellLinkEntry {
  return {
    rowId: 'r1',
    colId: 'cA',
    a1: 'A1',
    columnHeader: 'E-mail',
    span: {
      text: 'georgios@nestor.gr',
      kind: 'email',
      href: 'mailto:georgios@nestor.gr',
      offsetMm: 0,
      advanceMm: 10,
    },
    ...over,
  } as TableCellLinkEntry;
}

beforeEach(() => {
  closeTableLinkPicker();
  jest.clearAllMocks();
});

describe('🔴 κενή λίστα ΔΕΝ ανοίγει', () => {
  it('το store αρνείται — ο φρουρός ζει στην πηγή, όχι σε κάθε καλούντα', () => {
    openTableLinkPicker({ links: [], scope: 'table' });
    expect(getTableLinkPicker()).toBeNull();
  });

  it('και άρα τίποτα δεν αποδίδεται', () => {
    render(<TableLinkPicker />);
    act(() => openTableLinkPicker({ links: [], scope: 'table' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('η λίστα', () => {
  it('δείχνει το κείμενο του χρήστη, την ενέργεια και το πού', () => {
    render(<TableLinkPicker />);
    act(() => openTableLinkPicker({ links: [entry()], scope: 'table' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('georgios@nestor.gr')).toBeInTheDocument();
    expect(screen.getByText('Αποστολή e-mail')).toBeInTheDocument();
    expect(screen.getByText('E-mail')).toBeInTheDocument();
  });

  it('κλικ σε γραμμή ανοίγει ΚΑΙ κλείνει', () => {
    render(<TableLinkPicker />);
    act(() => openTableLinkPicker({ links: [entry()], scope: 'table' }));

    fireEvent.click(screen.getByRole('option'));
    expect(openCellLink).toHaveBeenCalledWith('mailto:georgios@nestor.gr');
    expect(getTableLinkPicker()).toBeNull();
  });

  it('Enter ανοίγει τη ΤΟΝΙΣΜΕΝΗ γραμμή', () => {
    const second = entry({
      rowId: 'r2',
      a1: 'A2',
      span: { text: 'b@nestor.gr', kind: 'email', href: 'mailto:b@nestor.gr', offsetMm: 0, advanceMm: 10 },
    });
    render(<TableLinkPicker />);
    act(() => openTableLinkPicker({ links: [entry(), second], scope: 'table' }));

    const input = screen.getByPlaceholderText('Αναζήτηση συνδέσμου…');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(openCellLink).toHaveBeenCalledWith('mailto:b@nestor.gr');
  });
});

describe('🔴 η αναζήτηση, και τα ΔΥΟ διαφορετικά «τίποτα»', () => {
  it('φιλτράρει και από την ΚΕΦΑΛΙΔΑ ΣΤΗΛΗΣ — αυτό διαβάζει ο χρήστης', () => {
    render(<TableLinkPicker />);
    act(() => openTableLinkPicker({ links: [entry()], scope: 'table' }));

    fireEvent.change(screen.getByPlaceholderText('Αναζήτηση συνδέσμου…'), {
      target: { value: 'e-mail' },
    });
    expect(screen.getByRole('option')).toBeInTheDocument();
  });

  it('«δεν ταιριάζει» ΔΕΝ είναι «δεν έχει» — δύο ερωτήσεις, δύο απαντήσεις', () => {
    render(<TableLinkPicker />);
    act(() => openTableLinkPicker({ links: [entry()], scope: 'table' }));

    fireEvent.change(screen.getByPlaceholderText('Αναζήτηση συνδέσμου…'), {
      target: { value: 'δενυπάρχει' },
    });
    expect(screen.getByText('Κανένας σύνδεσμος δεν ταιριάζει')).toBeInTheDocument();
    expect(screen.queryByText('Αυτός ο πίνακας δεν έχει συνδέσμους')).toBeNull();
  });

  it('ο δείκτης δεν δείχνει ποτέ έξω από τα φιλτραρισμένα — Enter σε άδειο δεν ανοίγει τίποτα', () => {
    render(<TableLinkPicker />);
    act(() => openTableLinkPicker({ links: [entry()], scope: 'table' }));

    const input = screen.getByPlaceholderText('Αναζήτηση συνδέσμου…');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.change(input, { target: { value: 'δενυπάρχει' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(openCellLink).not.toHaveBeenCalled();
  });
});

describe('ο τίτλος λέει ΤΙ ρωτάμε', () => {
  it('εμβέλεια πίνακα', () => {
    render(<TableLinkPicker />);
    act(() => openTableLinkPicker({ links: [entry()], scope: 'table' }));
    expect(screen.getByRole('dialog', { name: 'Σύνδεσμοι πίνακα' })).toBeInTheDocument();
  });

  it('εμβέλεια κελιού — με την αναφορά του κελιού μέσα', () => {
    render(<TableLinkPicker />);
    act(() => openTableLinkPicker({ links: [entry({ a1: 'B3' })], scope: 'cell' }));
    expect(screen.getByRole('dialog', { name: 'Σύνδεσμοι κελιού B3' })).toBeInTheDocument();
  });
});
