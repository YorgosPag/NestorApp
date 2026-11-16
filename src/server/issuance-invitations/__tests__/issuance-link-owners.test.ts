/**
 * ADR-915 §45.15 (1β-γ) — **ο κριτής των ιδιοκτητών του συνδέσμου**: η όψη δεν στέλνει ΠΟΤΕ ολόκληρο ΑΦΜ τρίτου· η
 * απάντηση κρίνεται απέναντι στους ιδιοκτήτες **τώρα**· αποτυχία ανάγνωσης ⇒ `null`/`unavailable`, ποτέ «κανένας».
 */

import type { Firestore } from 'firebase-admin/firestore';

import type { IssuanceLinkAnswerBody } from '@/lib/document-validity/issuance-request';
import { readOwnedContactDocs } from '@/server/lib/owned-contact-docs';

import type { ResolvedLink } from '../issuance-invitation-answer';
import { linkOwnersOf, resolveOwnerAttestation } from '../issuance-link-owners';

jest.mock('server-only', () => ({}));
jest.mock('@/lib/telemetry', () => ({ createModuleLogger: () => ({ warn: jest.fn(), error: jest.fn(), info: jest.fn() }) }));
jest.mock('@/server/lib/owned-contact-docs', () => ({ readOwnedContactDocs: jest.fn() }));

const read = readOwnedContactDocs as jest.MockedFunction<typeof readOwnedContactDocs>;
const DB = {} as Firestore;

/** Ο παραλήπτης (`cont_self`) + συνιδιοκτήτης με ΑΦΜ + συνιδιοκτήτης χωρίς επαφή. */
const LINK = {
  invitation: { id: 'diin_1', companyId: 'comp_1', contactId: 'cont_self' },
  label: { ownerContactIds: ['cont_self', 'cont_co', 'cont_gone'] },
  registry: { people: { cont_self: { name: 'Άλφα' }, cont_co: { name: 'Βήτα' } } },
} as unknown as ResolvedLink;

const DOCS = new Map([
  ['cont_self', { vatNumber: '090000045' }],
  ['cont_co', { vatNumber: '998877666' }],
]);

const approve = (ownerAttestation: unknown): IssuanceLinkAnswerBody =>
  ({ answer: 'approve', note: null, accessCode: null, quoteRevision: 1, ownerAttestation }) as IssuanceLinkAnswerBody;

beforeEach(() => read.mockReset());

describe('ADR-915 §45.15 — linkOwnersOf', () => {
  it('🔴 ολόκληρο ΑΦΜ ΜΟΝΟ για τον ίδιο· τρίτος = τελευταία ψηφία· χωρίς επαφή = «κανένα ΑΦΜ»', async () => {
    read.mockResolvedValue(DOCS);
    const owners = await linkOwnersOf(DB, LINK);
    expect(owners).toEqual([
      { contactId: 'cont_self', name: 'Άλφα', self: true, vat: { kind: 'full', value: '090000045' } },
      { contactId: 'cont_co', name: 'Βήτα', self: false, vat: { kind: 'masked', tail: '666' } },
      { contactId: 'cont_gone', name: null, self: false, vat: { kind: 'none' } },
    ]);
    expect(JSON.stringify(owners)).not.toContain('998877666');
    expect(read).toHaveBeenCalledWith(DB, 'comp_1', ['cont_self', 'cont_co', 'cont_gone']);
  });

  it('αποτυχία ανάγνωσης ⇒ `null` («δεν διαβάστηκαν»), ποτέ κενή λίστα', async () => {
    read.mockRejectedValue(new Error('down'));
    expect(await linkOwnersOf(DB, LINK)).toBeNull();
  });
});

describe('ADR-915 §45.15 — resolveOwnerAttestation', () => {
  const ALL_CONFIRMED = {
    owners: ['cont_self', 'cont_co', 'cont_gone'].map((contactId) => ({ contactId, verdict: 'confirmed', vatNumber: null })),
    missingNote: null,
  };

  it('χωρίς τεκμήριο ⇒ καμία ανάγνωση, `attestation: null`', async () => {
    expect(await resolveOwnerAttestation(DB, LINK, approve(null))).toEqual({ kind: 'ok', attestation: null });
    expect(read).not.toHaveBeenCalled();
  });

  it('«Σωστά» ⇒ το στιγμιότυπο παίρνει το ΤΡΕΧΟΝ ΑΦΜ από την επαφή', async () => {
    read.mockResolvedValue(DOCS);
    expect(await resolveOwnerAttestation(DB, LINK, approve(ALL_CONFIRMED))).toEqual({
      kind: 'ok',
      attestation: {
        owners: [
          { contactId: 'cont_self', verdict: 'confirmed', vatNumber: '090000045' },
          { contactId: 'cont_co', verdict: 'confirmed', vatNumber: '998877666' },
          { contactId: 'cont_gone', verdict: 'confirmed', vatNumber: null },
        ],
        missingNote: null,
      },
    });
  });

  it('🔴 οι ιδιοκτήτες άλλαξαν ⇒ `owners-changed`· η ανάγνωση απέτυχε ⇒ `unavailable`', async () => {
    read.mockResolvedValue(DOCS);
    const partial = { owners: ALL_CONFIRMED.owners.slice(0, 2), missingNote: null };
    expect(await resolveOwnerAttestation(DB, LINK, approve(partial))).toEqual({ kind: 'refused', refusal: 'owners-changed' });
    read.mockRejectedValue(new Error('down'));
    expect(await resolveOwnerAttestation(DB, LINK, approve(ALL_CONFIRMED))).toEqual({ kind: 'unavailable' });
  });
});
