/**
 * SPEC-242C — a debt maturity entry names its project by ID; the name comes from the
 * project document of the caller's company, never from the client.
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { readProjectDisplayName, resolveCompanyProjectName } from '../project-reference';

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
