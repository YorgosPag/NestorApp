/**
 * ADR-945 Φ3α — άγκυρες του **μέλους γραφείου βιτρίνας** στη ΜΙΑ μηχανή:
 * - η πρόσκληση του ιδιώτη **είναι** η αποστολή (κανάλι της πλατφόρμας ⇒ `sent`, ιδεμποτής ξανά)·
 * - μόνο μέλος **του προσκεκλημένου** γραφείου απαντά/προσφέρει, και η προσφορά ορίζει **ποιος υπογράφει**·
 * - ο σύνδεσμος δεν πράττει σε αίτημα της πλατφόρμας, το μέλος δεν πράττει σε απευθείας ανάθεση γραφείου·
 * - η ροή του γραφείου μένει **ίδια** (πρόταση γραφείου ⇒ `proposed`, καμία ειδοποίηση πλατφόρμας).
 */

import {
  PLATFORM_NOTICE_CHANNEL,
  issuanceStageOf,
  reduceIssuance,
  type IssuanceAction,
  type IssuanceActor,
  type IssuanceAssignmentRecord,
} from '@/lib/document-validity/issuance-assignment';
import type { QuoteTerms } from '@/lib/document-validity/issuance-quote';

const NOW = '2026-11-19T09:00:00.000Z';
const OWNER: IssuanceActor = { kind: 'owner', uid: 'uid_private', nowIso: NOW };
const OFFICE: IssuanceActor = { kind: 'office', uid: 'uid_agent', nowIso: NOW };
const MEMBER: IssuanceActor = { kind: 'workspace-member', uid: 'uid_member', companyId: 'comp_pro', nowIso: NOW };
const STRANGER: IssuanceActor = { kind: 'workspace-member', uid: 'uid_other', companyId: 'comp_other', nowIso: NOW };
const LINK: IssuanceActor = { kind: 'link', invitationId: 'inv_1', verifiedBy: 'access-code', nowIso: NOW };
const INSPECTOR = { qualification: 'energy-inspector-registered', registryNumber: null } as const;
const PROPOSE_SHOWCASE: IssuanceAction = { kind: 'propose', professional: { kind: 'workspace', companyId: 'comp_pro' }, credential: INSPECTOR };
const PROPOSE_CONTACT: IssuanceAction = { kind: 'propose', professional: { kind: 'contact', contactId: 'cont_pro' }, credential: INSPECTOR };
const TERMS: QuoteTerms = {
  basis: 'firm', amountMinor: 12_000, vatRatePercent: 24, vatIncluded: false,
  validUntil: '2026-12-31', scope: ['issuance', 'registration'], note: null, deliveryBusinessDays: 5, advance: null,
};
const SIGNED_QUOTE: IssuanceAction = { kind: 'quote', terms: TERMS, signerUid: 'uid_engineer' };
const UNSIGNED_QUOTE: IssuanceAction = { kind: 'quote', terms: TERMS };
const DECLINE: IssuanceAction = { kind: 'respond', outcome: 'declined', note: 'Δεν καλύπτουμε την περιοχή' };

function step(record: IssuanceAssignmentRecord | null, action: IssuanceAction, actor: IssuanceActor): IssuanceAssignmentRecord {
  const reduced = reduceIssuance('energy-certificate', record, null, action, actor);
  if (!reduced.ok) throw new Error(`${action.kind}: ${reduced.refusal}`);
  return reduced.record;
}

function refusalOf(record: IssuanceAssignmentRecord | null, action: IssuanceAction, actor: IssuanceActor): string | null {
  const reduced = reduceIssuance('energy-certificate', record, null, action, actor);
  return reduced.ok ? null : reduced.refusal;
}

const invited = (): IssuanceAssignmentRecord => step(null, PROPOSE_SHOWCASE, OWNER);

describe('ADR-945 Φ3α — η πρόσκληση του ιδιώτη ΕΙΝΑΙ η αποστολή', () => {
  it('πρόταση ιδιώτη ⇒ `sent`, με μήνυμα της πλατφόρμας χωρίς σύνδεσμο', () => {
    const record = invited();
    expect(issuanceStageOf(record)).toBe('sent');
    expect(record.notice).toEqual({
      channel: PLATFORM_NOTICE_CHANNEL, at: NOW, byUid: 'uid_private', invitationId: null, verification: null,
      note: null, delivery: null, reminders: null,
    });
  });

  it('η ίδια πρόσκληση ξανά ⇒ ιδεμποτής (`changed: false`), όχι άρνηση', () => {
    const record = invited();
    const again = reduceIssuance('energy-certificate', record, null, PROPOSE_SHOWCASE, OWNER);
    expect(again).toEqual({ ok: true, record, changed: false });
  });

  it('🔴 ο ιδιώτης ΔΕΝ προσκαλεί επαφή — δεν έχει βιβλίο επαφών', () => {
    expect(refusalOf(null, PROPOSE_CONTACT, OWNER)).toBe('actor-refused');
  });

  it('η πρόταση του ΓΡΑΦΕΙΟΥ μένει `proposed` — καμία ειδοποίηση πλατφόρμας (αμετάβλητη ροή §42)', () => {
    const record = step(null, PROPOSE_CONTACT, OFFICE);
    expect(issuanceStageOf(record)).toBe('proposed');
    expect(record.notice).toBeNull();
  });
});

describe('ADR-945 Φ3α — το μέλος του γραφείου βιτρίνας προσφέρει ή αρνείται', () => {
  it('προσφορά: `workspace-member` με το μέλος που υπογράφει', () => {
    const record = step(invited(), SIGNED_QUOTE, MEMBER);
    expect(issuanceStageOf(record)).toBe('quoted');
    expect(record.quote?.submission).toEqual({ by: 'workspace-member', uid: 'uid_member', companyId: 'comp_pro', signerUid: 'uid_engineer' });
  });

  it('άρνηση: βάση `workspace-member`', () => {
    const record = step(invited(), DECLINE, MEMBER);
    expect(issuanceStageOf(record)).toBe('declined');
    expect(record.response).toMatchObject({ basis: 'workspace-member', uid: 'uid_member', companyId: 'comp_pro', outcome: 'declined' });
  });

  it('🔴 προσφορά μέλους ΧΩΡΙΣ υπογράφοντα ⇒ `actor-refused`', () => {
    expect(refusalOf(invited(), UNSIGNED_QUOTE, MEMBER)).toBe('actor-refused');
  });

  it('🔴 μέλος ΞΕΝΟΥ γραφείου ⇒ `actor-refused`, για προσφορά και για άρνηση', () => {
    expect(refusalOf(invited(), SIGNED_QUOTE, STRANGER)).toBe('actor-refused');
    expect(refusalOf(invited(), DECLINE, STRANGER)).toBe('actor-refused');
  });

  it('🔴 ο σύνδεσμος ΔΕΝ πράττει σε αίτημα της πλατφόρμας (δεν υπάρχει σύνδεσμος να είναι «ο τρέχων»)', () => {
    expect(refusalOf(invited(), UNSIGNED_QUOTE, LINK)).toBe('actor-refused');
  });

  it('🔴 υπογράφων σε προσφορά που ΔΕΝ είναι μέλους ⇒ `actor-refused` (ο σύνδεσμος/η καταγραφή δεν ορίζουν μέλος)', () => {
    const officeSent = step(step(null, PROPOSE_CONTACT, OFFICE), { kind: 'notify', channel: 'phone', invitationId: null, note: null, verification: null }, OFFICE);
    expect(refusalOf(officeSent, SIGNED_QUOTE, OFFICE)).toBe('actor-refused');
  });

  it('🔴 το μέλος ΔΕΝ πράττει σε απευθείας ανάθεση γραφείου (κανάλι καταγραφής, όχι πλατφόρμας)', () => {
    const officeSent = step(step(null, PROPOSE_CONTACT, OFFICE), { kind: 'notify', channel: 'phone', invitationId: null, note: null, verification: null }, OFFICE);
    expect(refusalOf(officeSent, SIGNED_QUOTE, MEMBER)).toBe('actor-refused');
  });

  it.each<[string, IssuanceAction]>([
    ['decide', { kind: 'decide', outcome: 'approved', channel: null, note: null, ownerContactId: null, quoteRevision: 1, ownerAttestation: null }],
    ['cancel', { kind: 'cancel', reason: 'cancelled' }],
    ['record-receipt', { kind: 'record-receipt', mark: '123456789012345', issuedOn: '2026-11-19', totalMinor: 14_880 }],
  ])('🔴 %s — ΟΧΙ το μέλος (μόνο απάντηση και προσφορά)', (_, action) => {
    expect(refusalOf(step(invited(), SIGNED_QUOTE, MEMBER), action, MEMBER)).toBe('actor-refused');
  });
});
