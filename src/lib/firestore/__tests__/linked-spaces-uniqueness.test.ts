/**
 * ADR-247 F-1 · ADR-898 §20 — **ένας κάτοχος ανά χώρο, σε όλο το ΕΡΓΟ**. Ο χώρος μπορεί να βρίσκεται σε άλλο κτίριο από
 * τη μονάδα που τον έχει (θέση ≠ ανάθεση)· με εμβέλεια κτιρίου η Π-5 δινόταν και στο Α3 και στο Β2 χωρίς 409.
 */

jest.mock('server-only', () => ({}));
jest.mock('@/lib/auth/audit', () => ({ logAuditEvent: jest.fn() }));
jest.mock('@/services/entity-audit.service', () => ({ EntityAuditService: {} }));
jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: jest.fn() }));

import { validateLinkedSpacesUniqueness } from '../entity-linking.service';

type Doc = Record<string, unknown>;

/** Ψεύτικο `properties`: ισότητα σε ΕΝΑ πεδίο — καταγράφει ποιο ρωτήθηκε. */
function fakeDb(units: Record<string, Doc>) {
  const asked: [string, unknown][] = [];
  const db = {
    collection: () => ({
      where: (field: string, _op: string, value: unknown) => {
        asked.push([field, value]);
        const docs = Object.entries(units)
          .filter(([, data]) => data[field] === value)
          .map(([id, data]) => ({ id, data: () => data }));
        return { select: () => ({ get: async () => ({ docs }) }) };
      },
    }),
  };
  return { db: db as unknown as FirebaseFirestore.Firestore, asked };
}

const UNITS = {
  a3: { buildingId: 'A', projectId: 'prj', linkedSpaces: [] },
  b2: { buildingId: 'B', projectId: 'prj', linkedSpaces: [{ spaceId: 'p5' }] },
};

describe('validateLinkedSpacesUniqueness', () => {
  it('ΙΔΙΟ έργο, ΑΛΛΟ κτίριο: η Π-5 του Β2 ⇒ 409 για το Α3', async () => {
    const { db, asked } = fakeDb(UNITS);
    await expect(validateLinkedSpacesUniqueness(db, { projectId: 'prj', buildingId: 'A' }, 'a3', [{ spaceId: 'p5' }])).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(asked).toEqual([['projectId', 'prj']]);
  });

  it('η ίδια μονάδα ξαναγράφει τους χώρους της ⇒ περνά', async () => {
    const { db } = fakeDb(UNITS);
    await expect(validateLinkedSpacesUniqueness(db, { projectId: 'prj', buildingId: 'B' }, 'b2', [{ spaceId: 'p5' }])).resolves.toBeUndefined();
  });

  it('χωρίς έργο ⇒ εμβέλεια κτιρίου (ό,τι ίσχυε) · χωρίς τίποτα ⇒ κανένα ερώτημα', async () => {
    const { db, asked } = fakeDb(UNITS);
    await validateLinkedSpacesUniqueness(db, { projectId: null, buildingId: 'A' }, 'a3', [{ spaceId: 'p5' }]);
    await validateLinkedSpacesUniqueness(db, { projectId: null, buildingId: null }, 'a3', [{ spaceId: 'p5' }]);
    expect(asked).toEqual([['buildingId', 'A']]);
  });
});
