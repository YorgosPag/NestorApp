/**
 * SPEC-242C — a debt maturity entry names its project by ID; the name comes from the
 * project document of the caller's company, never from the client.
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import {
  readProjectDisplayName,
  readProjectName,
  resolveCompanyProjectName,
  resolveCompanyProjectNameOrNull,
} from '../project-reference';

function fakeDb(docs: Record<string, Record<string, unknown>>) {
  const reads: Array<{ path: string; id: string }> = [];
  const db = {
    collection: (path: string) => ({
      doc: (id: string) => ({
        get: async () => {
          reads.push({ path, id });
          const data = docs[id];
          return { exists: data !== undefined, data: () => data };
        },
      }),
    }),
  };
  return { db, reads };
}

describe('readProjectDisplayName', () => {
  it('prefers `name`, falls back to the legacy `title`, then to a placeholder', () => {
    expect(readProjectDisplayName({ name: 'Έργο Α', title: 'Παλιό' })).toBe('Έργο Α');
    expect(readProjectDisplayName({ title: 'Παλιό' })).toBe('Παλιό');
    expect(readProjectDisplayName({})).toBe('Unknown');
  });
});

describe('resolveCompanyProjectName', () => {
  it('returns the name of a project of the same company, read from the projects collection', async () => {
    const { db, reads } = fakeDb({ prj_1: { companyId: 'co1', name: 'ΕΡΓΟ ΛΑΡΙΣΑΣ' } });
    await expect(resolveCompanyProjectName(db, 'prj_1', 'co1')).resolves.toBe('ΕΡΓΟ ΛΑΡΙΣΑΣ');
    expect(reads).toEqual([{ path: COLLECTIONS.PROJECTS, id: 'prj_1' }]);
  });

  it('a project of another company answers exactly like a missing one', async () => {
    const { db } = fakeDb({ prj_1: { companyId: 'co2', name: 'Ξένο' } });
    await expect(resolveCompanyProjectName(db, 'prj_1', 'co1')).resolves.toBeNull();
    await expect(resolveCompanyProjectName(db, 'prj_missing', 'co1')).resolves.toBeNull();
  });
});

describe('readProjectName — for text a person receives (ADR-327 §7.5)', () => {
  it('same fallback as the display name, but an unnamed project is `null`, never a placeholder', () => {
    expect(readProjectName({ name: 'Έργο Α', title: 'Παλιό' })).toBe('Έργο Α');
    expect(readProjectName({ name: '  ', title: 'Παλιό' })).toBe('Παλιό');
    expect(readProjectName({})).toBeNull();
    expect(readProjectName({ name: ' ', title: ' ' })).toBeNull();
  });
});

describe('resolveCompanyProjectNameOrNull', () => {
  it('same tenant check as resolveCompanyProjectName; an unnamed project is `null` too', async () => {
    const { db } = fakeDb({
      prj_1: { companyId: 'co1', name: 'ΕΡΓΟ ΛΑΡΙΣΑΣ' },
      prj_2: { companyId: 'co1' },
      prj_3: { companyId: 'co2', name: 'Ξένο' },
    });
    await expect(resolveCompanyProjectNameOrNull(db, 'prj_1', 'co1')).resolves.toBe('ΕΡΓΟ ΛΑΡΙΣΑΣ');
    await expect(resolveCompanyProjectNameOrNull(db, 'prj_2', 'co1')).resolves.toBeNull();
    await expect(resolveCompanyProjectNameOrNull(db, 'prj_3', 'co1')).resolves.toBeNull();
    await expect(resolveCompanyProjectName(db, 'prj_2', 'co1')).resolves.toBe('Unknown');
  });
});
