/**
 * Ο κριτής των μεταβάσεων (ADR-923 §5.12 Σ1–Σ7): κάθε κελί του πίνακα της κεφαλίδας του.
 */

import {
  judgeAccessRequest,
  judgeInvitationAcceptance,
  judgeRelationshipEnd,
  judgeRequestApproval,
  judgeRequestDecline,
  relationshipParties,
  type SupplyRelationshipDraft,
  type SupplyTransition,
} from '../supply-relationship-judge';
import { SUPPLY_REQUEST_LIMIT, type SupplyRelationship } from '../../types/supply-relationship';

const ends = { supplierCompanyId: 'supplier', buyerCompanyId: 'buyer' };
const act = { uid: 'u_1', now: '2026-10-31T10:00:00.000Z' };

const relationship = (overrides: Partial<SupplyRelationship> = {}): SupplyRelationship => ({
  id: 'srel_1',
  companyId: 'supplier',
  buyerCompanyId: 'buyer',
  state: 'active',
  origin: 'invitation',
  supplierContactId: 'c1',
  customerRef: null,
  requestCount: 0,
  requestedByUid: null,
  requestedAt: null,
  acceptedByUid: 'u_old',
  acceptedAt: '2026-01-01T00:00:00.000Z',
  approvedByUid: null,
  approvedAt: null,
  endedBySide: null,
  endedByUid: null,
  endedAt: null,
  revision: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  updatedBy: 'u_old',
  ...overrides,
});

function nextOf(transition: SupplyTransition): SupplyRelationshipDraft {
  if (transition.kind !== 'write') throw new Error(`expected write, got ${transition.kind}`);
  return transition.next;
}

const accept = (current: SupplyRelationship | null, contactId = 'c1') => judgeInvitationAcceptance(current, { ends, contactId, act });
const request = (current: SupplyRelationship | null, customerRef: string | null = 'R-1') => judgeAccessRequest(current, { ends, customerRef, act });

describe('αποδοχή πρόσκλησης', () => {
  it('χωρίς σχέση ⇒ ενεργή, με την επαφή και το πρόσωπο της ακμής', () => {
    expect(nextOf(accept(null))).toMatchObject({ state: 'active', origin: 'invitation', supplierContactId: 'c1', acceptedByUid: 'u_1', acceptedAt: act.now, companyId: 'supplier', buyerCompanyId: 'buyer' });
  });

  it('εκκρεμές αίτημα ⇒ ενεργή: η πρόσκληση είναι ήδη συγκατάθεση του προμηθευτή', () => {
    expect(nextOf(accept(relationship({ state: 'requested', supplierContactId: null, requestCount: 2 })))).toMatchObject({ state: 'active', requestCount: 0 });
  });

  it('ανακλημένη ξαναζεί και σβήνει το τέλος της προηγούμενης ζωής', () => {
    const next = nextOf(accept(relationship({ state: 'revoked', endedBySide: 'buyer', endedByUid: 'u_x', endedAt: act.now })));
    expect(next).toMatchObject({ state: 'active', endedBySide: null, endedByUid: null, endedAt: null });
  });

  it('ενεργή με την ίδια επαφή ⇒ καμία αλλαγή', () => {
    expect(accept(relationship())).toEqual({ kind: 'unchanged' });
  });

  it('ενεργή χωρίς επαφή ⇒ δένει την επαφή, χωρίς νέα αποδοχή', () => {
    expect(nextOf(accept(relationship({ supplierContactId: null })))).toMatchObject({ supplierContactId: 'c1', acceptedByUid: 'u_old' });
  });

  it('ενεργή με άλλη επαφή ⇒ άρνηση, ποτέ σιωπηλή αντικατάσταση', () => {
    expect(accept(relationship(), 'c2')).toEqual({ kind: 'refused', reason: 'already-connected' });
  });
});

describe('αίτημα με σύνδεσμο', () => {
  it('χωρίς σχέση ⇒ `requested`, ποτέ ενεργή', () => {
    expect(nextOf(request(null))).toMatchObject({ state: 'requested', origin: 'link', customerRef: 'R-1', requestCount: 1, requestedByUid: 'u_1' });
  });

  it('ενεργή ⇒ άρνηση', () => {
    expect(request(relationship())).toEqual({ kind: 'refused', reason: 'already-connected' });
  });

  it('το ίδιο αίτημα δύο φορές δεν γράφει και δεν μετρά', () => {
    expect(request(relationship({ state: 'requested', customerRef: 'R-1', requestCount: 1 }))).toEqual({ kind: 'unchanged' });
  });

  it('νέος αριθμός πελάτη σε εκκρεμές αίτημα ενημερώνεται χωρίς να μετρά', () => {
    expect(nextOf(request(relationship({ state: 'requested', customerRef: 'R-0', requestCount: 1 })))).toMatchObject({ customerRef: 'R-1', requestCount: 1 });
  });

  it('μετά από απόρριψη ξαναζητά, ως το όριο', () => {
    expect(nextOf(request(relationship({ state: 'declined', requestCount: SUPPLY_REQUEST_LIMIT - 1, endedBySide: 'supplier' })))).toMatchObject({
      state: 'requested', requestCount: SUPPLY_REQUEST_LIMIT, endedBySide: null,
    });
    expect(request(relationship({ state: 'declined', requestCount: SUPPLY_REQUEST_LIMIT }))).toEqual({ kind: 'refused', reason: 'request-limit' });
  });
});

describe('οι πράξεις του προμηθευτή', () => {
  it('έγκριση: ο αποδέκτης της ακμής είναι όποιος ζήτησε, ο εγκρίνων γράφεται χωριστά', () => {
    const next = nextOf(judgeRequestApproval(relationship({ state: 'requested', requestedByUid: 'u_buyer', supplierContactId: null }), { contactId: 'c9', act }));
    expect(next).toMatchObject({ state: 'active', acceptedByUid: 'u_buyer', approvedByUid: 'u_1', approvedAt: act.now, supplierContactId: 'c9', requestCount: 0 });
  });

  it('έγκριση χωρίς νέα επαφή κρατά ό,τι υπήρχε', () => {
    expect(nextOf(judgeRequestApproval(relationship({ state: 'requested' }), { contactId: null, act }))).toMatchObject({ supplierContactId: 'c1' });
  });

  it.each(['active', 'declined', 'revoked'] as const)('έγκριση ή απόρριψη σε `%s` ⇒ άρνηση', (state) => {
    expect(judgeRequestApproval(relationship({ state }), { contactId: null, act })).toEqual({ kind: 'refused', reason: 'not-requested' });
    expect(judgeRequestDecline(relationship({ state }), act)).toEqual({ kind: 'refused', reason: 'not-requested' });
  });

  it('απόρριψη: το τέλος ανήκει στον προμηθευτή και ο μετρητής μένει', () => {
    expect(nextOf(judgeRequestDecline(relationship({ state: 'requested', requestCount: 2 }), act))).toMatchObject({ state: 'declined', endedBySide: 'supplier', endedByUid: 'u_1', requestCount: 2 });
  });
});

describe('ανάκληση (Σ7)', () => {
  it.each(['supplier', 'buyer'] as const)('από τον/την %s, άμεσα', (side) => {
    expect(nextOf(judgeRelationshipEnd(relationship(), { side, act }))).toMatchObject({ state: 'revoked', endedBySide: side, endedByUid: 'u_1', endedAt: act.now });
  });

  it('εκκρεμές αίτημα ανακαλείται από όποιον το έκανε', () => {
    expect(nextOf(judgeRelationshipEnd(relationship({ state: 'requested' }), { side: 'buyer', act }))).toMatchObject({ state: 'revoked' });
  });

  it.each(['declined', 'revoked'] as const)('δεύτερη ανάκληση σε `%s` δεν γράφει', (state) => {
    expect(judgeRelationshipEnd(relationship({ state }), { side: 'buyer', act })).toEqual({ kind: 'unchanged' });
  });
});

describe('οι ταυτότητες του αγοραστή (Σ6)', () => {
  it('η επαφή προηγείται του χώρου', () => {
    expect(relationshipParties(relationship())).toEqual([{ kind: 'contact', contactId: 'c1' }, { kind: 'workspace', companyId: 'buyer' }]);
  });

  it('χωρίς επαφή μένει ο χώρος', () => {
    expect(relationshipParties(relationship({ supplierContactId: null }))).toEqual([{ kind: 'workspace', companyId: 'buyer' }]);
  });
});
