/**
 * ADR-945 Φ1α — το σύνορο του δίσκου της ανάθεσης έκδοσης: ο επαγγελματίας ως ένωση (τα παλιά έγγραφα διαβάζονται
 * χωρίς μετανάστευση), ο κάτοχος ως `CustodyScope` (δύο όψεις), και η ταυτότητα γραφείου **αμετάβλητη**.
 */

import { generateDeterministicDocumentIssuanceAssignmentId } from '@/services/enterprise-id.service';
import {
  issuanceAssignmentIdOf,
  issuanceRecordOf,
  parseIssuanceAssignment,
  parseOwnedIssuanceAssignment,
} from '../issuance-assignment-schema';

const BASE = {
  id: 'diss_1',
  propertyId: 'prop_1',
  scope: 'property',
  documentKind: 'energy-certificate',
  credential: { qualification: 'energy-inspector-registered', registryNumber: null },
  proposedAt: '2026-11-18T09:00:00.000Z',
  proposedByUid: 'user_1',
  approvalRequest: null,
  decision: null,
  notice: null,
  response: null,
  cancellation: null,
  updatedAt: '2026-11-18T09:00:00.000Z',
} as const;

const CONTACT = { kind: 'contact', contactId: 'cont_pro' } as const;

describe('ADR-945 Δ4 — ο επαγγελματίας στο σύνορο του δίσκου', () => {
  it('Σ1 έγγραφο πριν από το ADR-945 (μόνο `professionalContactId`) ⇒ `{ kind: contact }`, καμία μετανάστευση', () => {
    const parsed = parseIssuanceAssignment({ ...BASE, companyId: 'comp_1', professionalContactId: 'cont_pro' });
    expect(parsed?.professional).toEqual(CONTACT);
    expect(parsed && issuanceRecordOf(parsed)).not.toHaveProperty('professionalContactId');
  });

  it('Σ2 νέο έγγραφο με την ένωση — επαφή και βιτρίνα', () => {
    expect(parseIssuanceAssignment({ ...BASE, companyId: 'comp_1', professional: CONTACT })?.professional).toEqual(CONTACT);
    const workspace = { kind: 'workspace', companyId: 'comp_pro' } as const;
    expect(parseIssuanceAssignment({ ...BASE, companyId: 'comp_1', professional: workspace })?.professional).toEqual(workspace);
  });

  it('Σ3 και τα δύο πεδία: δεκτό μόνο αν λένε το ΙΔΙΟ πρόσωπο — αλλιώς fail-closed', () => {
    expect(parseIssuanceAssignment({ ...BASE, companyId: 'comp_1', professional: CONTACT, professionalContactId: 'cont_pro' })).not.toBeNull();
    expect(parseIssuanceAssignment({ ...BASE, companyId: 'comp_1', professional: CONTACT, professionalContactId: 'cont_other' })).toBeNull();
  });

  it('Σ4 κανένας επαγγελματίας ⇒ `null`', () => {
    expect(parseIssuanceAssignment({ ...BASE, companyId: 'comp_1' })).toBeNull();
  });
});

describe('ADR-945 Δ1 — ο κάτοχος', () => {
  it('Κ1 γραφείο: και οι δύο όψεις το διαβάζουν', () => {
    const raw = { ...BASE, companyId: 'comp_1', professional: CONTACT };
    expect(parseIssuanceAssignment(raw)?.companyId).toBe('comp_1');
    expect(parseOwnedIssuanceAssignment(raw)?.owner).toEqual({ companyId: 'comp_1' });
  });

  it('Κ2 ιδιώτης: η όψη κατόχου το διαβάζει — η όψη γραφείου ΠΟΤΕ (ADR-787 Ε-3 §3)', () => {
    const raw = { ...BASE, userId: 'user_owner', professional: CONTACT };
    expect(parseOwnedIssuanceAssignment(raw)?.owner).toEqual({ userId: 'user_owner' });
    expect(parseIssuanceAssignment(raw)).toBeNull();
  });

  it('Κ3 κανένας ή δύο κάτοχοι ⇒ `null` (ακριβώς ένα βιβλίο)', () => {
    expect(parseOwnedIssuanceAssignment({ ...BASE, professional: CONTACT })).toBeNull();
    expect(parseOwnedIssuanceAssignment({ ...BASE, companyId: 'comp_1', userId: 'user_owner', professional: CONTACT })).toBeNull();
  });
});

describe('§27 — η ταυτότητα της απευθείας ανάθεσης γραφείου', () => {
  it('Τ1 byte προς byte ίδια με το seed `<companyId>:<property>:<kind>` (υπάρχουσες αναθέσεις και χρήματα μένουν στη θέση τους)', () => {
    expect(issuanceAssignmentIdOf('comp_1', 'prop_1', 'energy-certificate'))
      .toBe(generateDeterministicDocumentIssuanceAssignmentId('comp_1:prop_1:energy-certificate'));
  });
});

describe('ADR-945 §7.2 — η προσφορά αιτήματος στο σύνορο του δίσκου', () => {
  const OWNED = { ...BASE, userId: 'uid_private', professional: CONTACT };
  const DECISION_COMMON = { outcome: 'approved', quoteRevision: 1, ownerAttestation: null, note: null, at: BASE.updatedAt };

  it('Π1 έγγραφο πριν από τα αιτήματα ⇒ απευθείας ανάθεση (`requestId`/`cycle` = `null`)', () => {
    expect(parseOwnedIssuanceAssignment(OWNED)).toMatchObject({ requestId: null, cycle: null });
  });

  it('Π2 προσφορά: αίτημα ΚΑΙ κύκλος · 🔴 μόνο το ένα από τα δύο ⇒ `null`', () => {
    expect(parseOwnedIssuanceAssignment({ ...OWNED, requestId: 'disr_1', cycle: 2 })).toMatchObject({ requestId: 'disr_1', cycle: 2 });
    expect(parseOwnedIssuanceAssignment({ ...OWNED, requestId: 'disr_1' })).toBeNull();
    expect(parseOwnedIssuanceAssignment({ ...OWNED, cycle: 2 })).toBeNull();
  });

  it('Π3 ακύρωση χωρίς λόγο (παλιό έγγραφο) ⇒ «ακυρώθηκε» · «δεν επιλέχθηκε» διαβάζεται όπως γράφτηκε', () => {
    const at = BASE.updatedAt;
    expect(parseOwnedIssuanceAssignment({ ...OWNED, cancellation: { at, byUid: 'u' } })?.cancellation?.reason).toBe('cancelled');
    expect(parseOwnedIssuanceAssignment({ ...OWNED, cancellation: { at, byUid: 'u', reason: 'not-awarded' } })?.cancellation?.reason).toBe('not-awarded');
  });

  it('Π4 απόφαση `owner-self` διαβάζεται · 🔴 απόφαση γραφείου ΧΩΡΙΣ υπεύθυνο ⇒ `null`', () => {
    const self = { ...DECISION_COMMON, basis: 'owner-self', uid: 'uid_private' };
    expect(parseOwnedIssuanceAssignment({ ...OWNED, decision: self })?.decision).toMatchObject({ basis: 'owner-self', uid: 'uid_private' });
    const orphan = { ...DECISION_COMMON, basis: 'recorded-instruction', channel: 'phone', recordedByUid: 'u' };
    expect(parseOwnedIssuanceAssignment({ ...OWNED, decision: orphan })).toBeNull();
  });
});

describe('ADR-945 Φ3α — το γραφείο βιτρίνας στο σύνορο του δίσκου', () => {
  const SHOWCASE_BID = { ...BASE, userId: 'uid_private', professional: { kind: 'workspace', companyId: 'comp_pro' }, requestId: 'disr_1', cycle: 1 };
  const NOTICE = {
    channel: 'nestor-inbox', at: BASE.updatedAt, byUid: 'uid_private', invitationId: null, verification: null,
    note: null, delivery: null, reminders: null,
  };
  const TERMS = {
    basis: 'firm', amountMinor: 12_000, vatRatePercent: 24, vatIncluded: false, validUntil: '2026-12-31',
    scope: ['issuance'], note: null, deliveryBusinessDays: 5, advance: null,
  };

  it('Β1 μήνυμα της πλατφόρμας + προσφορά μέλους (με υπογράφοντα) διαβάζονται όπως γράφτηκαν', () => {
    const submission = { by: 'workspace-member', uid: 'uid_member', companyId: 'comp_pro', signerUid: 'uid_engineer' };
    const quote = { ...TERMS, revision: 1, at: BASE.updatedAt, submission, previous: null };
    const parsed = parseOwnedIssuanceAssignment({ ...SHOWCASE_BID, notice: NOTICE, quote });
    expect(parsed?.notice?.channel).toBe('nestor-inbox');
    expect(parsed?.quote?.submission).toEqual(submission);
  });

  it('Β2 άρνηση μέλους διαβάζεται · 🔴 προσφορά μέλους ΧΩΡΙΣ υπογράφοντα ⇒ `null` (fail-closed)', () => {
    const response = { basis: 'workspace-member', uid: 'uid_member', companyId: 'comp_pro', outcome: 'declined', note: null, at: BASE.updatedAt };
    expect(parseOwnedIssuanceAssignment({ ...SHOWCASE_BID, notice: NOTICE, response })?.response).toMatchObject({ basis: 'workspace-member' });
    const submission = { by: 'workspace-member', uid: 'uid_member', companyId: 'comp_pro' };
    const unsigned = { ...TERMS, revision: 1, at: BASE.updatedAt, submission, previous: null };
    expect(parseOwnedIssuanceAssignment({ ...SHOWCASE_BID, notice: NOTICE, quote: unsigned })).toBeNull();
  });
});
