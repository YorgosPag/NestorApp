/**
 * `useSpaceTableExport` (ADR-898 Φ4β) — η εξαγωγή παίρνει **τη σειρά του πίνακα** (και την επιστρέφει όταν ο πίνακας
 * ξαναστηθεί), στις **κάρτες** τη σειρά των δεδομένων (αυτήν που φαίνεται εκεί), και γράφει στις «Παραδοχές» **τι**
 * φιλτραρίστηκε — «Ν από Μ», ποτέ αρχείο που μοιάζει πλήρες ενώ είναι υποσύνολο.
 */

import { act, renderHook } from '@testing-library/react';

import type { SpaceTableExport } from '../space-table-export';
import type { SpaceColumn } from '../types';
import { useSpaceTableExport, type SpaceTableExportInput } from '../useSpaceTableExport';

const exported: SpaceTableExport<Row>[] = [];
jest.mock('../space-table-export', () => {
  const actual = jest.requireActual('../space-table-export');
  return { ...actual, exportSpaceTableXlsx: async (input: SpaceTableExport<Row>) => { exported.push(input); } };
});
jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string, params?: Record<string, unknown>) => (params ? `${key}::${JSON.stringify(params)}` : key) }),
}));
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

interface Row {
  readonly id: string;
}

const COLUMNS: SpaceColumn<Row>[] = [{ key: 'id', label: 'Κωδικός', render: () => null, sortValue: (r) => r.id, exportCell: (r) => r.id }];
const FILTER = { value: 'small', options: [{ value: 'small', label: 'Μικρή' }], allLabel: 'Όλοι' };

function input(overrides: Partial<SpaceTableExportInput<Row>> = {}): SpaceTableExportInput<Row> {
  return {
    buildingName: 'Κτίριο Α',
    tabLabel: 'Αποθήκες',
    columns: COLUMNS,
    items: [{ id: 'A' }, { id: 'B' }],
    totalCount: 5,
    viewMode: 'table',
    searchTerm: ' υπόγ ',
    typeFilter: FILTER,
    statusFilter: { ...FILTER, value: 'all' },
    ...overrides,
  };
}

async function exportWith(hookInput: SpaceTableExportInput<Row>, sortDescending = false) {
  const { result } = renderHook(() => useSpaceTableExport(hookInput));
  if (sortDescending) act(() => result.current.tableSort.onSortChange({ key: 'id', direction: 'desc' }));
  await act(async () => result.current.exportAction.trigger());
  return { file: exported[exported.length - 1], result };
}

const rowsOf = (file: SpaceTableExport<Row>) => Object.fromEntries(file.assumptions.rows);

describe('useSpaceTableExport', () => {
  it('πίνακας: εξάγει τη σειρά που διάλεξε ο άνθρωπος — και την επιστρέφει ως `initialSort` όταν ο πίνακας ξαναστηθεί', async () => {
    const { file, result } = await exportWith(input(), true);
    expect(file.schedule.sort).toEqual({ key: 'id', direction: 'desc' });
    expect(result.current.tableSort.initialSort).toEqual({ key: 'id', direction: 'desc' });
  });

  it('κάρτες: η σειρά των δεδομένων (οι κάρτες δεν ταξινομούν) — ό,τι φαίνεται, αυτό εξάγεται', async () => {
    const { file } = await exportWith(input({ viewMode: 'cards' }), true);
    expect(file.schedule.sort).toBeNull();
    expect(rowsOf(file)['spaceExport.assumptions.sort']).toBe('spaceExport.assumptions.sortNone');
  });

  it('Παραδοχές: «Ν από Μ», η αναζήτηση όπως γράφτηκε, το ΟΝΟΜΑ του φίλτρου (όχι η τιμή του)', async () => {
    const { file } = await exportWith(input());
    const rows = rowsOf(file);
    expect(rows['spaceExport.assumptions.rows']).toBe('spaceExport.assumptions.rowsOf::{"shown":2,"total":5}');
    expect(rows['spaceExport.assumptions.search']).toBe('υπόγ');
    expect(rows['spaceExport.assumptions.type']).toBe('Μικρή');
    expect(rows['spaceExport.assumptions.status']).toBe('Όλοι');
    expect(file.schedule.items).toHaveLength(2);
    expect(file.schedule.footer).toEqual({ id: 'spaceExport.totalRow::{"rows":2}' });
  });
});
