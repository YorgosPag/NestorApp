/**
 * ADR-898 §20 — **παρακολούθημα μονάδας δεν αποσυνδέεται από κτίριο**: χωρίς κτίριο θα μετρούσε σιωπηλά στο κτίριο της
 * μονάδας του, δηλαδή το «Αποσύνδεση» δεν θα έκανε τίποτα ορατό. Η μετακίνηση σε ΑΛΛΟ κτίριο επιτρέπεται (θέση ≠ ανάθεση).
 */

jest.mock('server-only', () => ({}));
jest.mock('@/lib/auth/audit', () => ({ logAuditEvent: jest.fn() }));
jest.mock('@/services/entity-audit.service', () => ({ EntityAuditService: {} }));
jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: jest.fn() }));

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { POLICY_ERROR_CODES } from '@/lib/policy/policy-error-codes';

import { assertNotDetachingAttachedSpace } from '../space-attachment-guard';

type Doc = Record<string, unknown>;

function fakeDb(units: Record<string, Doc>, buildings: Record<string, Doc> = {}) {
  const asked: [string, unknown][] = [];
  const db = {
    collection: (name: string) => ({
      doc: (id: string) => ({ get: async () => ({ data: () => (name === 'buildings' ? buildings[id] : undefined) }) }),
      where: (field: string, _op: string, value: unknown) => {
        asked.push([field, value]);
        const docs = Object.entries(units).filter(([, data]) => data[field] === value).map(([id, data]) => ({ id, data: () => data }));
        return { select: () => ({ get: async () => ({ docs }) }) };
      },
    }),
  };
  return { db: db as unknown as AdminFirestore, asked };
}

const UNITS = { a3: { buildingId: 'A', projectId: 'prj', linkedSpaces: [{ spaceId: 'p5' }] } };
const P5 = { buildingId: 'B', projectId: 'prj' };

describe('assertNotDetachingAttachedSpace', () => {
  it('αποσύνδεση (`null`) χώρου που ανήκει σε μονάδα — ακόμη και ΑΛΛΟΥ κτιρίου ⇒ 409 με κωδικό πολιτικής', async () => {
    const { db } = fakeDb(UNITS);
    await expect(assertNotDetachingAttachedSpace(db, 'p5', { buildingId: null }, P5)).rejects.toMatchObject({
      statusCode: 409,
      errorCode: POLICY_ERROR_CODES.SPACE_LINKED_TO_UNIT,
    });
  });

  it('κενό κείμενο είναι επίσης αποσύνδεση', async () => {
    const { db } = fakeDb(UNITS);
    await expect(assertNotDetachingAttachedSpace(db, 'p5', { buildingId: '  ' }, P5)).rejects.toMatchObject({ statusCode: 409 });
  });

  it('μετακίνηση σε άλλο κτίριο · σώμα που δεν αγγίζει το κτίριο · χώρος ήδη χωρίς κτίριο ⇒ κανένα ερώτημα', async () => {
    const { db, asked } = fakeDb(UNITS);
    await assertNotDetachingAttachedSpace(db, 'p5', { buildingId: 'C' }, P5);
    await assertNotDetachingAttachedSpace(db, 'p5', { number: 'Π-5' }, P5);
    await assertNotDetachingAttachedSpace(db, 'p5', { buildingId: null }, { projectId: 'prj' });
    expect(asked).toEqual([]);
  });

  it('χώρος χωρίς μονάδα ⇒ η αποσύνδεση περνά', async () => {
    const { db } = fakeDb({});
    await expect(assertNotDetachingAttachedSpace(db, 'p5', { buildingId: null }, P5)).resolves.toBeUndefined();
  });

  it('χώρος χωρίς έργο ⇒ το έργο του ΚΤΙΡΙΟΥ του (η σύνδεση είναι μοναδική ανά έργο)', async () => {
    const { db, asked } = fakeDb(UNITS, { B: { projectId: 'prj' } });
    await expect(assertNotDetachingAttachedSpace(db, 'p5', { buildingId: null }, { buildingId: 'B' })).rejects.toMatchObject({ statusCode: 409 });
    expect(asked).toEqual([['projectId', 'prj']]);
  });
});
