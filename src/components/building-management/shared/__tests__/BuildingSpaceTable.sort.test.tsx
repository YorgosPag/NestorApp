/**
 * 🧪 BuildingSpaceTable — where a row with NO value lands when you sort.
 *
 * Guards ADR-777 Φ4. Before it, price columns extracted `u.price || 0`, so a
 * unit whose price was never recorded sorted as the CHEAPEST one: ascending put
 * it first, and the reader had no way to tell "0 €" apart from "unknown".
 *
 * The convention pinned here is the spreadsheet one — blanks last in ascending
 * AND descending — not the SQL default, where NULLs flip to the front under
 * DESC. Somebody sorting a table is looking for an extreme, and a row with no
 * value is a candidate for neither end.
 *
 * ⚠️ This file exists because nothing else locks it: the sort lives inside a
 * `useMemo` in the component, so a future edit to the comparator would leave
 * every other test in this folder green.
 *
 * ⚠️ MEASURED, so nobody mistakes coverage for proof: deleting the null guard
 * from the comparator turns exactly ONE of the cases below red — the
 * DESCENDING one. Ascending survives by accident, because without the guard a
 * `null` falls through to the string branch and `String(null)` is `"null"`,
 * which sorts after every digit. So the descending case is the load-bearing
 * anchor here; the ascending one documents the convention but cannot defend it.
 * Do not "simplify" the two into one.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BuildingSpaceTable } from '../BuildingSpaceTable';
import type { SpaceColumn } from '../types';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/hooks/useIconSizes', () => ({
  useIconSizes: () => ({ sm: 'h-4 w-4', md: 'h-5 w-5' }),
}));

interface Row {
  id: string;
  /** `null` = this unit has no recorded price. */
  price: number | null;
}

const ROWS: Row[] = [
  { id: 'no-price', price: null },
  { id: 'expensive', price: 300 },
  { id: 'cheap', price: 100 },
];

const COLUMNS: SpaceColumn<Row>[] = [
  {
    key: 'id',
    label: 'id',
    render: (r) => <span>{r.id}</span>,
  },
  {
    key: 'price',
    label: 'price',
    sortValue: (r) => r.price,
    render: (r) => <span>{r.price ?? '—'}</span>,
  },
];

/** Row order as rendered, read from the `id` column. */
function renderedOrder(): string[] {
  return screen
    .getAllByRole('row')
    .slice(1) // drop the header row
    .map((row) => row.querySelectorAll('td')[0]?.textContent ?? '');
}

describe('BuildingSpaceTable — rows with no value sort last', () => {
  beforeEach(() => {
    render(<BuildingSpaceTable items={ROWS} columns={COLUMNS} getKey={(r) => r.id} />);
  });

  it('places the unpriced row LAST when sorting ascending', () => {
    fireEvent.click(screen.getByText('price'));
    expect(renderedOrder()).toEqual(['cheap', 'expensive', 'no-price']);
  });

  it('places the unpriced row LAST when sorting descending too', () => {
    // The whole point: the missing value does NOT flip to the front.
    fireEvent.click(screen.getByText('price'));
    fireEvent.click(screen.getByText('price'));
    expect(renderedOrder()).toEqual(['expensive', 'cheap', 'no-price']);
  });

  it('never ranks the unpriced row as the cheapest one', () => {
    fireEvent.click(screen.getByText('price'));
    expect(renderedOrder()[0]).not.toBe('no-price');
  });
});

describe('BuildingSpaceTable — existing behaviour is unchanged', () => {
  it('still sorts a fully-populated numeric column both ways', () => {
    const priced = ROWS.filter((r) => r.price !== null);
    render(<BuildingSpaceTable items={priced} columns={COLUMNS} getKey={(r) => r.id} />);

    fireEvent.click(screen.getByText('price'));
    expect(renderedOrder()).toEqual(['cheap', 'expensive']);

    fireEvent.click(screen.getByText('price'));
    expect(renderedOrder()).toEqual(['expensive', 'cheap']);
  });
});

describe('BuildingSpaceTable — ADR-898 Φ4β: αρχική ταξινόμηση, `<tfoot>`, προσβάσιμες επικεφαλίδες', () => {
  it('ανοίγει ήδη ταξινομημένος (`initialSort`) και το `aria-sort` το λέει', () => {
    render(<BuildingSpaceTable items={ROWS} columns={COLUMNS} getKey={(r) => r.id} initialSort={{ key: 'price', direction: 'desc' }} />);
    expect(renderedOrder()).toEqual(['expensive', 'cheap', 'no-price']);
    expect(screen.getByRole('columnheader', { name: /price/ })).toHaveAttribute('aria-sort', 'descending');
  });

  it('η ταξινόμηση είναι ΚΟΥΜΠΙ (πληκτρολόγιο), όχι κλικ σε κελί', () => {
    render(<BuildingSpaceTable items={ROWS} columns={COLUMNS} getKey={(r) => r.id} />);
    fireEvent.click(screen.getByRole('button', { name: 'price' }));
    expect(screen.getByRole('columnheader', { name: /price/ })).toHaveAttribute('aria-sort', 'ascending');
  });

  it('`renderFooter` ⇒ `<tfoot>` με το πλήθος στηλών · χωρίς αυτό ⇒ κανένα `<tfoot>`', () => {
    const { container, rerender } = render(<BuildingSpaceTable items={ROWS} columns={COLUMNS} getKey={(r) => r.id} />);
    expect(container.querySelector('tfoot')).toBeNull();
    rerender(
      <BuildingSpaceTable
        items={ROWS}
        columns={COLUMNS}
        getKey={(r) => r.id}
        renderFooter={({ columnCount }) => <tr><td colSpan={columnCount}>total</td></tr>}
      />,
    );
    expect(container.querySelector('tfoot td')).toHaveAttribute('colspan', '2');
  });

  it('στήλη `exportOnly` ΔΕΝ ζωγραφίζεται (ούτε επικεφαλίδα ούτε κελί) και δεν μετρά στο `colSpan`', () => {
    const withExportOnly: SpaceColumn<Row>[] = [
      ...COLUMNS,
      { key: 'unit', label: 'export-only-unit', exportOnly: true, render: () => <span>κελί-αρχείου</span>, exportCell: () => 'x' },
    ];
    const { container } = render(
      <BuildingSpaceTable items={ROWS} columns={withExportOnly} getKey={(r) => r.id} renderFooter={({ columnCount }) => <tr><td colSpan={columnCount} /></tr>} />,
    );
    expect(screen.queryByText('export-only-unit')).toBeNull();
    expect(screen.queryByText('κελί-αρχείου')).toBeNull();
    expect(container.querySelector('tfoot td')).toHaveAttribute('colspan', '2');
  });
});
