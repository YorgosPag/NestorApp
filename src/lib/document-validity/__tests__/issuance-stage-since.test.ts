/**
 * ADR-915 §45 Φ1 — άγκυρες του «από πότε»: η στιγμή του γεγονότος που **γέννησε** το τρέχον στάδιο, για κάθε στάδιο,
 * στη νέα ροή (§42) και στην παλιά (§27). Κάθε βήμα γίνεται σε **άλλη** ώρα, ώστε λάθος γεγονός να κοκκινίζει.
 */

import {
  issuanceStageOf,
  reduceIssuance,
  type IssuanceAction,
  type IssuanceAssignmentRecord,
} from '@/lib/document-validity/issuance-assignment';
import { issuanceStageSinceOf } from '@/lib/document-validity/issuance-stage';
import type { QuoteTerms } from '@/lib/document-validity/issuance-quote';

const INSPECTOR = { qualification: 'energy-inspector-registered', registryNumber: 'ΥΠΕΝ-123' } as const;
const TERMS: QuoteTerms = {
  basis: 'firm', amountMinor: 10_000, vatRatePercent: 24, vatIncluded: false,
  validUntil: '2026-12-31', scope: ['issuance', 'registration'], note: null, deliveryBusinessDays: 5, advance: null,
};
const PROPOSE: IssuanceAction = { kind: 'propose', professionalContactId: 'cont_pro', credential: INSPECTOR };
const NOTIFY: IssuanceAction = { kind: 'notify', channel: 'email', invitationId: null, note: null, verification: null };
const QUOTE: IssuanceAction = { kind: 'quote', terms: TERMS };
const decide = (outcome: 'approved' | 'rejected', quoteRevision: number): IssuanceAction =>
  ({ kind: 'decide', outcome, channel: 'phone', note: null, ownerContactId: 'cont_lead', quoteRevision, ownerAttestation: null });
const DECLINE: IssuanceAction = { kind: 'respond', outcome: 'declined', note: null };
const CANCEL: IssuanceAction = { kind: 'cancel' };

/** Η ώρα του βήματος `i` — μία διαφορετική ημέρα ανά βήμα. */
const at = (i: number): string => `2026-11-0${i + 1}T09:00:00.000Z`;

function run(actions: readonly IssuanceAction[]): IssuanceAssignmentRecord {
  let record: IssuanceAssignmentRecord | null = null;
  actions.forEach((action, i) => {
    const reduced = reduceIssuance('energy-certificate', record, null, action, { kind: 'office', uid: 'uid_agent', nowIso: at(i) });
    if (!reduced.ok) throw new Error(`${action.kind}: ${reduced.refusal}`);
    record = reduced.record;
  });
  if (record === null) throw new Error('no record');
  return record;
}

describe('ADR-915 §45 Φ1 — issuanceStageSinceOf (νέα ροή §42)', () => {
  it.each([
    ['proposed', [PROPOSE], 0],
    ['sent', [PROPOSE, NOTIFY], 1],
    ['quoted', [PROPOSE, NOTIFY, QUOTE], 2],
    ['accepted', [PROPOSE, NOTIFY, QUOTE, decide('approved', 1)], 3],
    ['ownerRejected', [PROPOSE, NOTIFY, QUOTE, decide('rejected', 1)], 3],
    ['declined', [PROPOSE, NOTIFY, DECLINE], 2],
    ['cancelled', [PROPOSE, NOTIFY, QUOTE, CANCEL], 3],
  ] as const)('%s ⇒ η στιγμή του βήματος που το γέννησε', (stage, actions, step) => {
    const record = run(actions);
    expect(issuanceStageOf(record)).toBe(stage);
    expect(issuanceStageSinceOf(record)).toBe(at(step));
  });

  it('η πρόταση ξανά (μετά από άρνηση) ⇒ «από» τη ΝΕΑ πρόταση, όχι την παλιά', () => {
    const record = run([PROPOSE, NOTIFY, DECLINE, { kind: 'propose', professionalContactId: 'cont_other', credential: INSPECTOR }]);
    expect(issuanceStageOf(record)).toBe('proposed');
    expect(issuanceStageSinceOf(record)).toBe(at(3));
  });
});

describe('ADR-915 §45 Φ1 — issuanceStageSinceOf (παλιά ροή §27)', () => {
  /** Απόφαση για το πρόσωπο, χωρίς αναθεώρηση προσφοράς — στη μέρα 2. */
  function legacy(extra: Partial<IssuanceAssignmentRecord> = {}): IssuanceAssignmentRecord {
    return {
      ...run([PROPOSE]),
      decision: {
        basis: 'recorded-instruction', channel: 'phone', recordedByUid: 'uid_agent', outcome: 'approved',
        quoteRevision: null, ownerContactId: 'cont_lead', ownerAttestation: null, note: null, at: at(1),
      },
      ...extra,
    };
  }

  it('ownerApproved ⇒ η απόφαση', () => {
    expect(issuanceStageOf(legacy())).toBe('ownerApproved');
    expect(issuanceStageSinceOf(legacy())).toBe(at(1));
  });

  it('accepted ⇒ η ΑΠΑΝΤΗΣΗ του επαγγελματία, όχι η απόφαση', () => {
    const record = legacy({
      notice: { channel: 'phone', at: at(2), byUid: 'uid_agent', invitationId: null, verification: null, note: null, delivery: null, reminders: null },
      response: { basis: 'recorded', recordedByUid: 'uid_agent', outcome: 'accepted', note: null, at: at(3) },
    });
    expect(issuanceStageOf(record)).toBe('accepted');
    expect(issuanceStageSinceOf(record)).toBe(at(3));
  });
});
