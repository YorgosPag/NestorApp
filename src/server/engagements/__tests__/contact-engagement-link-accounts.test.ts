/**
 * ADR-915 §40.8 — «Συνδέθηκε ως»: **μόνο όνομα**, **μόνο** για αποδεκτή συνεργασία, ανάγνωση ταυτοτήτων **μόνο** όταν
 * τη ζητά ο καλών. Η κρίση συμμετοχών (`judgeCurrentPerSubject`) τρέχει **αληθινή**· μόνο τα σύνορα I/O είναι ψεύτικα.
 *
 * Α1 — αποδεκτή ⇒ το όνομα του λογαριασμού (ενιαίο + δομημένο) · ΚΑΝΕΝΑ uid/email · ΚΑΜΙΑ ετυμηγορία στην απόκριση
 *      (ADR-915 §40.10: η κρίση «ίδιο / διαφορετικό» γίνεται στον πελάτη, πάνω στη ζωντανή επαφή).
 * Α2 — σκέτη πρόταση ⇒ καμία ταυτότητα, καμία κλήση στο Auth (δεν έχει συναινέσει).
 * Α3 — `{ read: false }` (υιοθέτηση) ⇒ καμία κλήση στο Auth.
 * Α4 — λογαριασμός που δεν διαβάστηκε ⇒ όλα `null` — ποτέ κενό σαν γνωστό.
 * Μ1–Μ4 — ADR-915 §40.9: ο ΕΝΑΣ αποδεκτός λογαριασμός (ok · none · ambiguous · unknown) για την υιοθέτηση ονόματος.
 * Κ1–Κ5 — ADR-944 §3.7: τα κλειδιά email των αποδεκτών λογαριασμών (άγκυρες) · άγνωστο ⇒ `unknown`, ποτέ «καμία άγκυρα».
 */

import type { Firestore } from 'firebase-admin/firestore';

import type { IssuanceEngagement } from '@/types/engagement';

import {
  readAcceptedAccountEmailKeys,
  readContactProfessionalLink,
  readSoleAcceptedAccount,
} from '../contact-engagement-link.server';

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
  it('Α1 — αποδεκτή ⇒ όνομα λογαριασμού, χωρίς uid/email, χωρίς ετυμηγορία', async () => {
    mockDocs.mockReturnValue([issuance('active')]);
    mockReadAccountIdentities.mockResolvedValue(new Map([['u_pro', {
      uid: 'u_pro', displayName: 'ΓΕΩΡΓΙΟΣ ΠΕΑΣ', email: 'pro@example.gr', emailVerified: true, givenName: 'ΓΕΩΡΓΙΟΣ', familyName: 'ΠΕΑΣ',
    }]]));
    const read = await readContactProfessionalLink(db, 'comp_host', 'cont_1', NOW, { read: true });
    expect(read).toMatchObject({ outcome: 'ok', link: { status: 'linked', accounts: [{
      displayName: 'ΓΕΩΡΓΙΟΣ ΠΕΑΣ', givenName: 'ΓΕΩΡΓΙΟΣ', familyName: 'ΠΕΑΣ',
    }] } });
    const wire = JSON.stringify(read);
    expect(wire).not.toContain('u_pro');
    expect(wire).not.toContain('pro@example.gr');
    expect(wire).not.toContain('nameMatch');
  });

  it('Α2 — σκέτη πρόταση ⇒ καμία ταυτότητα, καμία κλήση στο Auth', async () => {
    mockDocs.mockReturnValue([issuance('offered')]);
    const read = await readContactProfessionalLink(db, 'comp_host', 'cont_1', NOW, { read: true });
    expect(read).toMatchObject({ outcome: 'ok', link: { status: 'offered', accounts: [] } });
    expect(mockReadAccountIdentities).not.toHaveBeenCalled();
  });

  it('Α3 — { read: false } ⇒ καμία κλήση στο Auth', async () => {
    mockDocs.mockReturnValue([issuance('active')]);
    const read = await readContactProfessionalLink(db, 'comp_host', 'cont_1', NOW, { read: false });
    expect(read).toMatchObject({ outcome: 'ok', link: { status: 'linked', accounts: [] } });
    expect(mockReadAccountIdentities).not.toHaveBeenCalled();
  });

  it('Α4 — λογαριασμός που δεν διαβάστηκε ⇒ όλα null', async () => {
    mockDocs.mockReturnValue([issuance('active')]);
    mockReadAccountIdentities.mockResolvedValue(new Map());
    const read = await readContactProfessionalLink(db, 'comp_host', 'cont_1', NOW, { read: true });
    expect(read).toMatchObject({ outcome: 'ok', link: { accounts: [{ displayName: null, givenName: null, familyName: null }] } });
  });
});

describe('readSoleAcceptedAccount — ADR-915 §40.9', () => {
  const IDENTITY = { uid: 'u_pro', displayName: 'ΓΕΩΡΓΙΟΣ ΠΕΑΣ', email: 'pro@example.gr', emailVerified: true, givenName: 'Γεώργιος', familyName: 'Πέας' };

  it('Μ1 — ένας αποδεκτός ⇒ ok με την ταυτότητά του', async () => {
    mockDocs.mockReturnValue([issuance('active')]);
    mockReadAccountIdentities.mockResolvedValue(new Map([['u_pro', IDENTITY]]));
    await expect(readSoleAcceptedAccount(db, 'comp_host', 'cont_1', NOW)).resolves.toEqual({ outcome: 'ok', identity: IDENTITY });
  });

  it('Μ2 — μόνο πρόταση ⇒ none, καμία κλήση στο Auth', async () => {
    mockDocs.mockReturnValue([issuance('offered')]);
    await expect(readSoleAcceptedAccount(db, 'comp_host', 'cont_1', NOW)).resolves.toEqual({ outcome: 'none' });
    expect(mockReadAccountIdentities).not.toHaveBeenCalled();
  });

  it('Μ3 — δύο διαφορετικοί αποδεκτοί λογαριασμοί ⇒ ambiguous', async () => {
    const other = { ...issuance('active'), id: 'eng_other', uid: 'u_other', subject: { kind: 'document_issuance' as const, assignmentId: 'dias_other' } };
    mockDocs.mockReturnValue([issuance('active'), other]);
    await expect(readSoleAcceptedAccount(db, 'comp_host', 'cont_1', NOW)).resolves.toEqual({ outcome: 'ambiguous' });
  });

  it('Μ4 — ο λογαριασμός δεν διαβάστηκε ⇒ unknown, ποτέ none', async () => {
    mockDocs.mockReturnValue([issuance('active')]);
    mockReadAccountIdentities.mockResolvedValue(new Map());
    await expect(readSoleAcceptedAccount(db, 'comp_host', 'cont_1', NOW)).resolves.toEqual({ outcome: 'unknown' });
  });
});

describe('readAcceptedAccountEmailKeys — άγκυρες ταυτότητας (ADR-944 §3.7)', () => {
  const identity = (email: string | null) => new Map([['u_pro', {
    uid: 'u_pro', displayName: 'ΓΕΩΡΓΙΟΣ ΠΕΑΣ', email, emailVerified: true, givenName: null, familyName: null,
  }]]);

  it('Κ1 — αποδεκτή ⇒ το κλειδί (πεζά + trim) του email του λογαριασμού', async () => {
    mockDocs.mockReturnValue([issuance('active')]);
    mockReadAccountIdentities.mockResolvedValue(identity('  Pro@Example.GR '));
    const read = await readAcceptedAccountEmailKeys(db, 'comp_host', 'cont_1', NOW);
    expect(read.outcome).toBe('ok');
    expect(read.outcome === 'ok' ? [...read.keys] : null).toEqual(['pro@example.gr']);
  });

  it('Κ2 — καμία αποδεκτή (σκέτη πρόταση) ⇒ κανένα κλειδί, καμία κλήση στο Auth', async () => {
    mockDocs.mockReturnValue([issuance('offered')]);
    const read = await readAcceptedAccountEmailKeys(db, 'comp_host', 'cont_1', NOW);
    expect(read.outcome === 'ok' ? read.keys.size : -1).toBe(0);
    expect(mockReadAccountIdentities).not.toHaveBeenCalled();
  });

  it('Κ3 — λογαριασμός που λείπει από τον χάρτη ⇒ unknown (ποτέ «καμία άγκυρα»)', async () => {
    mockDocs.mockReturnValue([issuance('active')]);
    mockReadAccountIdentities.mockResolvedValue(new Map());
    await expect(readAcceptedAccountEmailKeys(db, 'comp_host', 'cont_1', NOW)).resolves.toEqual({ outcome: 'unknown' });
  });

  it('Κ4 — λογαριασμός χωρίς email ⇒ unknown', async () => {
    mockDocs.mockReturnValue([issuance('active')]);
    mockReadAccountIdentities.mockResolvedValue(identity(null));
    await expect(readAcceptedAccountEmailKeys(db, 'comp_host', 'cont_1', NOW)).resolves.toEqual({ outcome: 'unknown' });
  });

  it('Κ5 — αποτυχία ανάγνωσης συμμετοχών ⇒ unknown', async () => {
    mockDocs.mockImplementation(() => { throw new Error('firestore down'); });
    await expect(readAcceptedAccountEmailKeys(db, 'comp_host', 'cont_1', NOW)).resolves.toEqual({ outcome: 'unknown' });
  });
});
