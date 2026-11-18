/**
 * ADR-945 §7.2 — άγκυρες του συνόρου του αιτήματος προσφορών: οι δύο ταυτότητες (γραφείο ≠ ιδιώτης · επαφή ≠ βιτρίνα ·
 * κύκλος στο id) και το fail-closed σχήμα (ένα βιβλίο · ≤ 3 προσφορές · νικήτρια του κύκλου).
 */

import { bidIdOf, issuanceRequestIdOf, parseIssuanceRequest } from '@/services/document-registry/issuance-request-schema';
import { issuanceAssignmentIdOf } from '@/services/document-registry/issuance-assignment-schema';

const BID = {
  bidId: 'dibd_1',
  professional: { kind: 'workspace', companyId: 'comp_pro' },
  invitedAt: '2026-11-18T09:00:00.000Z',
  invitedByUid: 'uid_private',
};
const STORED = {
  id: 'disr_1', userId: 'uid_private', propertyId: 'oprop_1', scope: 'property', documentKind: 'energy-certificate',
  cycle: 1, bids: [BID], award: null, closure: null, updatedAt: '2026-11-18T09:00:00.000Z',
};

describe('ADR-945 §7.2 — ταυτότητες', () => {
  it('αίτημα γραφείου ≠ αίτημα ιδιώτη με το ίδιο αναγνωριστικό (πρόθεμα `user:`)', () => {
    const office = issuanceRequestIdOf({ companyId: 'same' }, 'p1', 'energy-certificate');
    const personal = issuanceRequestIdOf({ userId: 'same' }, 'p1', 'energy-certificate');
    expect(office).toMatch(/^disr_/);
    expect(personal).not.toBe(office);
  });

  it('η προσφορά δεν συμπίπτει ποτέ με την απευθείας ανάθεση γραφείου (άλλο πρόθεμα)', () => {
    const bid = bidIdOf('disr_1', 1, { kind: 'contact', contactId: 'cont_1' });
    expect(bid).toMatch(/^dibd_/);
    expect(bid).not.toBe(issuanceAssignmentIdOf('comp_1', 'p1', 'energy-certificate'));
  });

  it('επαφή ≠ βιτρίνα με το ίδιο id · κύκλος 1 ≠ κύκλος 2', () => {
    const contact = bidIdOf('disr_1', 1, { kind: 'contact', contactId: 'x' });
    expect(bidIdOf('disr_1', 1, { kind: 'workspace', companyId: 'x' })).not.toBe(contact);
    expect(bidIdOf('disr_1', 2, { kind: 'contact', contactId: 'x' })).not.toBe(contact);
    expect(bidIdOf('disr_1', 1, { kind: 'contact', contactId: 'x' })).toBe(contact);
  });
});

describe('ADR-945 §7.2 — το σχήμα του δίσκου (fail-closed)', () => {
  it('αίτημα ιδιώτη διαβάζεται με κάτοχο `{ userId }`', () => {
    expect(parseIssuanceRequest(STORED)).toMatchObject({ owner: { userId: 'uid_private' }, cycle: 1, bids: [BID] });
  });

  it('🔴 δύο βιβλία ⇒ `null`', () => {
    expect(parseIssuanceRequest({ ...STORED, companyId: 'comp_1' })).toBeNull();
  });

  it('🔴 τέσσερις προσφορές ⇒ `null`', () => {
    expect(parseIssuanceRequest({ ...STORED, bids: [BID, BID, BID, BID] })).toBeNull();
  });

  it('🔴 νικήτρια που δεν είναι προσφορά του κύκλου ⇒ `null`', () => {
    expect(parseIssuanceRequest({ ...STORED, award: { bidId: 'dibd_other', at: STORED.updatedAt, byUid: 'uid_private' } })).toBeNull();
  });

  it('🔴 ανατεθειμένο ΚΑΙ ακυρωμένο ⇒ `null`', () => {
    const award = { bidId: 'dibd_1', at: STORED.updatedAt, byUid: 'uid_private' };
    const closure = { kind: 'cancelled', at: STORED.updatedAt, byUid: 'uid_private' };
    expect(parseIssuanceRequest({ ...STORED, award, closure })).toBeNull();
  });
});
