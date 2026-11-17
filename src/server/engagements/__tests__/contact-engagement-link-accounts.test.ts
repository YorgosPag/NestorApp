/**
 * ADR-915 §40.8 — «Συνδέθηκε ως»: **μόνο όνομα**, **μόνο** για αποδεκτή συνεργασία, ανάγνωση ταυτοτήτων **μόνο** όταν
 * τη ζητά ο καλών. Η κρίση συμμετοχών (`judgeCurrentPerSubject`) τρέχει **αληθινή**· μόνο τα σύνορα I/O είναι ψεύτικα.
 *
 * Α1 — αποδεκτή ⇒ όνομα + `differs` (το αληθινό εύρημα Μαυρίδης/ΠΕΑΣ) · ΚΑΝΕΝΑ uid/email στην απόκριση.
 * Α2 — σκέτη πρόταση ⇒ καμία ταυτότητα, καμία κλήση στο Auth (δεν έχει συναινέσει).
 * Α3 — `{ read: false }` (υιοθέτηση) ⇒ καμία κλήση στο Auth.
 * Α4 — λογαριασμός που δεν διαβάστηκε ⇒ `displayName: null`, `unknown` — ποτέ κενό σαν γνωστό.
 */

import type { Firestore } from 'firebase-admin/firestore';

import type { IssuanceEngagement } from '@/types/engagement';

import { readContactProfessionalLink } from '../contact-engagement-link.server';

const mockDocs = jest.fn<readonly unknown[], []>();
const mockReadAccountIdentities = jest.fn();

jest.mock('@/lib/auth/engagement-ref', () => ({
  engagementsOfContactQuery: () => ({ get: async () => ({ docs: mockDocs().map((raw) => ({ data: () => raw })) }) }),
}));
jest.mock('@/lib/auth/engagement-schema', () => ({ parseEngagement: (raw: unknown) => raw }));
jest.mock('../engagement-hosts', () => ({
  hostLineOf: async () => ({ propertyId: 'prop_1', propertyName: 'Δοκιμή', documentKind: 'energy-certificate' }),
}));
jest.mock('@/server/auth/account-identities', () => ({
  readAccountIdentities: (...args: unknown[]) => mockReadAccountIdentities(...args),
}));

const NOW = Date.parse('2026-11-17T09:00:00.000Z');
const DAY = 86_400_000;
const db = {} as Firestore;
const MAVRIDIS = { firstName: 'Αλέξανδρος', lastName: 'Μαυρίδης' };

function issuance(state: 'active' | 'offered'): IssuanceEngagement {
  return {
    id: `eng_${state}`, hostCompanyId: 'comp_host', projectId: 'proj_1', uid: 'u_pro', email: 'pro@example.gr',
    template: 'issuer', role: 'document_issuer', subject: { kind: 'document_issuance', assignmentId: `dias_${state}` },
    scopes: ['issuance:assignment:collaborate'], state, expiresAt: new Date(NOW + 30 * DAY).toISOString(),
    origin: { kind: 'professional_appointment', contactId: 'cont_1' }, consents: [],
    offeredBy: 'u_host', offeredAt: new Date(NOW - DAY).toISOString(), respondedAt: state === 'active' ? new Date(NOW - DAY).toISOString() : null,
    revokedBy: null, closedAt: null, updatedAt: new Date(NOW - DAY).toISOString(),
  };
}

beforeEach(() => {
  mockDocs.mockReset();
  mockReadAccountIdentities.mockReset();
});

describe('readContactProfessionalLink — λογαριασμοί (ADR-915 §40.8)', () => {
  it('Α1 — αποδεκτή ⇒ όνομα + differs, χωρίς uid/email', async () => {
    mockDocs.mockReturnValue([issuance('active')]);
    mockReadAccountIdentities.mockResolvedValue(new Map([['u_pro', {
      uid: 'u_pro', displayName: 'ΓΕΩΡΓΙΟΣ ΠΕΑΣ', email: 'pro@example.gr', emailVerified: true, givenName: 'ΓΕΩΡΓΙΟΣ', familyName: 'ΠΕΑΣ',
    }]]));
    const read = await readContactProfessionalLink(db, 'comp_host', 'cont_1', NOW, { read: true, contactName: MAVRIDIS });
    expect(read).toMatchObject({ outcome: 'ok', link: { status: 'linked', accounts: [{ displayName: 'ΓΕΩΡΓΙΟΣ ΠΕΑΣ', nameMatch: 'differs' }] } });
    const wire = JSON.stringify(read);
    expect(wire).not.toContain('u_pro');
    expect(wire).not.toContain('pro@example.gr');
  });

  it('Α2 — σκέτη πρόταση ⇒ καμία ταυτότητα, καμία κλήση στο Auth', async () => {
    mockDocs.mockReturnValue([issuance('offered')]);
    const read = await readContactProfessionalLink(db, 'comp_host', 'cont_1', NOW, { read: true, contactName: MAVRIDIS });
    expect(read).toMatchObject({ outcome: 'ok', link: { status: 'offered', accounts: [] } });
    expect(mockReadAccountIdentities).not.toHaveBeenCalled();
  });

  it('Α3 — { read: false } ⇒ καμία κλήση στο Auth', async () => {
    mockDocs.mockReturnValue([issuance('active')]);
    const read = await readContactProfessionalLink(db, 'comp_host', 'cont_1', NOW, { read: false });
    expect(read).toMatchObject({ outcome: 'ok', link: { status: 'linked', accounts: [] } });
    expect(mockReadAccountIdentities).not.toHaveBeenCalled();
  });

  it('Α4 — λογαριασμός που δεν διαβάστηκε ⇒ null + unknown', async () => {
    mockDocs.mockReturnValue([issuance('active')]);
    mockReadAccountIdentities.mockResolvedValue(new Map());
    const read = await readContactProfessionalLink(db, 'comp_host', 'cont_1', NOW, { read: true, contactName: MAVRIDIS });
    expect(read).toMatchObject({ outcome: 'ok', link: { accounts: [{ displayName: null, nameMatch: 'unknown' }] } });
  });
});
