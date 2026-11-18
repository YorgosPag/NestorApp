/**
 * ADR-945 Δ3 — άγκυρες του **ιδιώτη ως ιδιοκτήτη και γραφείου μαζί**: ο actor `owner` αποφασίζει ο ίδιος (`owner-self`),
 * χωρίς υπεύθυνο-επαφή και χωρίς κανάλι καταγραφής· κάνει μόνο πρόταση, απόφαση και ακύρωση· και ο λόγος ακύρωσης
 * γράφεται (ADR-945 §7.2).
 */

import {
  decisionOwnerContactIdOf,
  reduceIssuance,
  type IssuanceAction,
  type IssuanceActor,
  type IssuanceAssignmentRecord,
} from '@/lib/document-validity/issuance-assignment';
import type { QuoteTerms } from '@/lib/document-validity/issuance-quote';

const NOW = '2026-11-18T09:00:00.000Z';
const OFFICE: IssuanceActor = { kind: 'office', uid: 'uid_agent', nowIso: NOW };
const OWNER: IssuanceActor = { kind: 'owner', uid: 'uid_private', nowIso: NOW };
const INSPECTOR = { qualification: 'energy-inspector-registered', registryNumber: null } as const;
const PROPOSE: IssuanceAction = { kind: 'propose', professional: { kind: 'workspace', companyId: 'comp_pro' }, credential: INSPECTOR };
const NOTIFY: IssuanceAction = { kind: 'notify', channel: 'email', invitationId: null, note: null, verification: null };
const TERMS: QuoteTerms = {
  basis: 'firm', amountMinor: 12_000, vatRatePercent: 24, vatIncluded: false,
  validUntil: '2026-12-31', scope: ['issuance', 'registration'], note: null, deliveryBusinessDays: 5, advance: null,
};
const QUOTE: IssuanceAction = { kind: 'quote', terms: TERMS };
const SELF_APPROVE: IssuanceAction = {
  kind: 'decide', outcome: 'approved', channel: null, note: null, ownerContactId: null, quoteRevision: 1, ownerAttestation: null,
};

/** Η πράξη από τον actor της, αλλιώς σφάλμα (ο δρόμος του τεστ πρέπει να είναι νόμιμος). */
function step(record: IssuanceAssignmentRecord | null, action: IssuanceAction, actor: IssuanceActor): IssuanceAssignmentRecord {
  const reduced = reduceIssuance('energy-certificate', record, null, action, actor);
  if (!reduced.ok) throw new Error(`${action.kind}: ${reduced.refusal}`);
  return reduced.record;
}

/** Ως το `quoted`: η ενημέρωση και η προσφορά καταγράφονται εδώ από γραφείο — η πρόσκληση του ιδιώτη έρχεται στη Φ3. */
function quoted(): IssuanceAssignmentRecord {
  return step(step(step(null, PROPOSE, OWNER), NOTIFY, OFFICE), QUOTE, OFFICE);
}

function refusalOf(record: IssuanceAssignmentRecord | null, action: IssuanceAction, actor: IssuanceActor): string | null {
  const reduced = reduceIssuance('energy-certificate', record, null, action, actor);
  return reduced.ok ? null : reduced.refusal;
}

describe('ADR-945 Δ3 — η απόφαση του ιδιώτη ΕΙΝΑΙ η έγκριση', () => {
  it('ο ιδιώτης εγκρίνει την προσφορά: βάση `owner-self`, χωρίς υπεύθυνο-επαφή', () => {
    const decision = step(quoted(), SELF_APPROVE, OWNER).decision;
    expect(decision).toMatchObject({ basis: 'owner-self', uid: 'uid_private', outcome: 'approved', quoteRevision: 1 });
    expect(decision).not.toHaveProperty('ownerContactId');
    expect(decision === null ? 'none' : decisionOwnerContactIdOf(decision)).toBeNull();
  });

  it('🔴 ο ιδιώτης ΔΕΝ «καταγράφει» εντολή (κανάλι) — αποφασίζει ο ίδιος, ποτέ για λογαριασμό άλλου', () => {
    expect(refusalOf(quoted(), { ...SELF_APPROVE, channel: 'phone' } as IssuanceAction, OWNER)).toBe('actor-refused');
  });

  it('🔴 ο ιδιώτης ΔΕΝ δηλώνει υπεύθυνο-επαφή — δεν είναι επαφή κανενός βιβλίου', () => {
    expect(refusalOf(quoted(), { ...SELF_APPROVE, ownerContactId: 'cont_lead' } as IssuanceAction, OWNER)).toBe('actor-refused');
  });

  it('🔴 το γραφείο ΔΕΝ αποφασίζει χωρίς υπεύθυνο-επαφή (η βάση `owner-self` είναι μόνο του ιδιώτη)', () => {
    expect(refusalOf(quoted(), { ...SELF_APPROVE, channel: 'phone' } as IssuanceAction, OFFICE)).toBe('actor-refused');
  });

  it('η απόφαση γραφείου κρατά τον υπεύθυνο στη βάση της — ίδιο σχήμα δίσκου με πριν', () => {
    const office: IssuanceAction = { ...SELF_APPROVE, channel: 'phone', ownerContactId: 'cont_lead' } as IssuanceAction;
    const decision = step(quoted(), office, OFFICE).decision;
    expect(decision).toMatchObject({ basis: 'recorded-instruction', ownerContactId: 'cont_lead' });
    expect(decision === null ? null : decisionOwnerContactIdOf(decision)).toBe('cont_lead');
  });
});

describe('ADR-945 Δ3 — τι κάνει ο ιδιώτης, και τι ΟΧΙ', () => {
  it('προτείνει και ακυρώνει — ο λόγος ακύρωσης γράφεται', () => {
    const cancelled = step(step(null, PROPOSE, OWNER), { kind: 'cancel', reason: 'cancelled' }, OWNER);
    expect(cancelled.cancellation).toEqual({ at: NOW, byUid: 'uid_private', reason: 'cancelled' });
  });

  it('«δεν επιλέχθηκε» είναι κι αυτό ακύρωση, με τον δικό του λόγο (Lost ≠ Declined)', () => {
    const lost = step(step(null, PROPOSE, OWNER), { kind: 'cancel', reason: 'not-awarded' }, OWNER);
    expect(lost.cancellation?.reason).toBe('not-awarded');
  });

  it.each<[string, IssuanceAction]>([
    ['notify', NOTIFY],
    ['quote', QUOTE],
    ['respond', { kind: 'respond', outcome: 'declined', note: null }],
    ['record-receipt', { kind: 'record-receipt', mark: '123456789012345', issuedOn: '2026-11-18', totalMinor: 14_880 }],
  ])('🔴 %s — ΟΧΙ ο ιδιώτης (ανήκει στον επαγγελματία ή έρχεται σε επόμενη φάση)', (_, action) => {
    const start = action.kind === 'notify' ? step(null, PROPOSE, OWNER) : quoted();
    expect(refusalOf(start, action, OWNER)).toBe('actor-refused');
  });
});
