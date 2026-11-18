/**
 * ADR-915 §27 · §42 — άγκυρες της ανάθεσης έκδοσης: ο μειωτής (νόμιμες μεταβάσεις · ιδεμπότητα · «ποτέ δύο»), το στάδιο
 * που ΠΑΡΑΓΕΤΑΙ από τα γεγονότα, η μπάλα, η προσφορά πριν από την ανάθεση, η ολοκλήρωση από το μητρώο και η κατάταξη
 * υποψηφίων.
 */

import {
  ISSUANCE_STAGES,
  ballInCourtOf,
  canProposeIssuance,
  issuanceStageOf,
  issuanceStateOf,
  qualifiesFor,
  reduceIssuance,
  type IssuanceAction,
  type IssuanceActor,
  type IssuanceAssignmentRecord,
} from '@/lib/document-validity/issuance-assignment';
import { rankIssuanceCandidates, type IssuanceRosterEntry } from '@/lib/document-validity/issuance-candidates';
import type { QuoteTerms } from '@/lib/document-validity/issuance-quote';

const ACTOR = { kind: 'office', uid: 'uid_agent', nowIso: '2026-10-17T09:00:00.000Z' } as const;
const INSPECTOR = { qualification: 'energy-inspector-registered', registryNumber: 'ΥΠΕΝ-123' } as const;
const PROPOSE: IssuanceAction = { kind: 'propose', professional: { kind: 'contact', contactId: 'cont_pro' }, credential: INSPECTOR };
const NOTIFY: IssuanceAction = { kind: 'notify', channel: 'email', invitationId: null, note: null, verification: null };
const FIRM_TERMS: QuoteTerms = {
  basis: 'firm', amountMinor: 10_000, vatRatePercent: 24, vatIncluded: false,
  validUntil: '2026-12-31', scope: ['issuance', 'registration'], note: null, deliveryBusinessDays: 5, advance: null,
};
const INDICATIVE_TERMS: QuoteTerms = { ...FIRM_TERMS, basis: 'indicative' };
const QUOTE: IssuanceAction = { kind: 'quote', terms: FIRM_TERMS };
const QUOTE_INDICATIVE: IssuanceAction = { kind: 'quote', terms: INDICATIVE_TERMS };
const approve = (quoteRevision: number): IssuanceAction =>
  ({ kind: 'decide', outcome: 'approved', channel: 'phone', note: null, ownerContactId: 'cont_lead', quoteRevision, ownerAttestation: null });
const APPROVE = approve(1);
const REJECT: IssuanceAction = { ...approve(1), outcome: 'rejected' } as IssuanceAction;
const RESPOND_DECLINED: IssuanceAction = { kind: 'respond', outcome: 'declined', note: null };
const MARK = '123456789012345';

/** Η πλήρης ροή §42 μέχρι την ανάθεση (δεσμευτική προσφορά). */
const ASSIGNED: IssuanceAction[] = [PROPOSE, NOTIFY, QUOTE, APPROVE];

function run(actions: readonly IssuanceAction[], latestIssuedOn: string | null = null): IssuanceAssignmentRecord {
  let record: IssuanceAssignmentRecord | null = null;
  for (const action of actions) {
    const reduced = reduceIssuance('energy-certificate', record, latestIssuedOn, action, ACTOR);
    if (!reduced.ok) throw new Error(`${action.kind}: ${reduced.refusal}`);
    record = reduced.record;
  }
  if (record === null) throw new Error('no record');
  return record;
}

function refusalOf(record: IssuanceAssignmentRecord | null, action: IssuanceAction, actor: IssuanceActor = ACTOR): string | null {
  const reduced = reduceIssuance('energy-certificate', record, null, action, actor);
  return reduced.ok ? null : reduced.refusal;
}

/** Παλιά ανάθεση (§27): απόφαση για το πρόσωπο, χωρίς αναθεώρηση προσφοράς. */
function legacy(extra: Partial<IssuanceAssignmentRecord> = {}): IssuanceAssignmentRecord {
  return {
    ...run([PROPOSE]),
    decision: {
      basis: 'recorded-instruction', channel: 'phone', recordedByUid: 'uid_agent', outcome: 'approved',
      quoteRevision: null, ownerContactId: 'cont_lead', ownerAttestation: null, note: null, at: ACTOR.nowIso,
    },
    ...extra,
  };
}

const LEGACY_NOTICE = { channel: 'email', at: ACTOR.nowIso, byUid: 'uid_agent', invitationId: null, verification: null, note: null, delivery: null, reminders: null } as const;

describe('ADR-915 §42 — ο μειωτής', () => {
  it('ο πλήρης δρόμος: πρόταση → αίτημα προσφοράς → προσφορά → έγκριση, και η μπάλα αλλάζει χέρια', () => {
    const seen = ASSIGNED.map((_, index) => {
      const stage = issuanceStageOf(run(ASSIGNED.slice(0, index + 1)));
      return [stage, ballInCourtOf(stage)];
    });
    expect(seen).toEqual([
      ['proposed', 'office'],
      ['sent', 'professional'],
      ['quoted', 'owner'],
      ['accepted', 'professional'],
    ]);
  });

  it('🔴 Καμία απόφαση, προσφορά ή απάντηση πριν σταλεί το αίτημα προσφοράς (από `proposed`)', () => {
    const proposed = run([PROPOSE]);
    for (const action of [APPROVE, RESPOND_DECLINED, QUOTE, { kind: 'record-receipt', mark: MARK, issuedOn: '2026-10-18', totalMinor: 12_400 }] as IssuanceAction[]) {
      expect(refusalOf(proposed, action)).toBe('transition-refused');
    }
  });

  it('🔴 Η απόφαση δεν γίνεται πριν υπάρξει προσφορά (από `sent`) — ούτε το αίτημα έγκρισης', () => {
    const sent = run([PROPOSE, NOTIFY]);
    expect(refusalOf(sent, APPROVE)).toBe('transition-refused');
    expect(refusalOf(sent, { kind: 'request-approval', invitationId: 'inv_o', ownerContactId: 'cont_lead', note: null, verification: 'link' })).toBe('transition-refused');
  });

  it('η απόφαση γράφει ΠΟΙΟΝ ιδιοκτήτη, ΠΩΣ, ΠΟΤΕ και ΠΟΙΑ αναθεώρηση — βάση «καταγραφή εντολής»', () => {
    expect(run(ASSIGNED).decision).toEqual({
      outcome: 'approved', ownerContactId: 'cont_lead', basis: 'recorded-instruction', channel: 'phone', note: null,
      recordedByUid: 'uid_agent', at: ACTOR.nowIso, quoteRevision: 1, ownerAttestation: null,
    });
  });

  it('η προσφορά του γραφείου γράφεται με υποβολή «recorded» και αναθεώρηση 1', () => {
    const quote = run([PROPOSE, NOTIFY, QUOTE]).quote;
    expect(quote).toEqual({
      ...FIRM_TERMS, revision: 1, at: ACTOR.nowIso, submission: { by: 'recorded', recordedByUid: 'uid_agent' }, previous: null,
    });
  });

  it('ιδεμποτές: η ΙΔΙΑ πρόταση ξανά ⇒ `changed: false`, ίδια γεγονότα', () => {
    const proposed = run([PROPOSE]);
    expect(reduceIssuance('energy-certificate', proposed, null, PROPOSE, { ...ACTOR, nowIso: '2026-10-18T09:00:00.000Z' }))
      .toEqual({ ok: true, record: proposed, changed: false });
  });

  it('🔴 «ποτέ δύο»: μετά την ενημέρωση νέα πρόταση ΑΡΝΕΙΤΑΙ — πριν, αντικαθιστά (και τα γεγονότα ξεκινούν από την αρχή)', () => {
    const other: IssuanceAction = { ...PROPOSE, professional: { kind: 'contact', contactId: 'cont_other' } } as IssuanceAction;
    for (const committed of [[PROPOSE, NOTIFY], [PROPOSE, NOTIFY, QUOTE], ASSIGNED]) {
      expect(reduceIssuance('energy-certificate', run(committed), null, other, ACTOR)).toEqual({ ok: false, refusal: 'transition-refused' });
    }
    const replaced = reduceIssuance('energy-certificate', run([PROPOSE]), null, other, ACTOR);
    expect(replaced.ok && replaced.record.professional).toEqual({ kind: 'contact', contactId: 'cont_other' });
    expect(replaced.ok && replaced.record.decision).toBeNull();
  });

  it('αρνήθηκε (ή αποσύρθηκε) ⇒ η μπάλα στο γραφείο, και νέα πρόταση επιτρέπεται', () => {
    for (const steps of [[PROPOSE, NOTIFY, RESPOND_DECLINED], [PROPOSE, NOTIFY, QUOTE, RESPOND_DECLINED], [...ASSIGNED, RESPOND_DECLINED]]) {
      const state = issuanceStateOf(run(steps), null);
      expect(state.kind === 'open' && [state.stage, state.ballInCourt]).toEqual(['declined', 'office']);
      expect(canProposeIssuance(state)).toBe(true);
    }
  });

  it('ακύρωση και απόρριψη ιδιοκτήτη ΚΛΕΙΝΟΥΝ τον κύκλο: καμία μπάλα, νέα πρόταση ελεύθερη', () => {
    for (const closing of [[PROPOSE, { kind: 'cancel', reason: 'cancelled' }], [PROPOSE, NOTIFY, QUOTE, REJECT]] as IssuanceAction[][]) {
      const state = issuanceStateOf(run(closing), null);
      expect(state.kind).toBe('none');
      expect(canProposeIssuance(state)).toBe(true);
    }
    expect(ballInCourtOf('cancelled')).toBeNull();
    expect(ballInCourtOf('ownerRejected')).toBeNull();
  });

  it('η ολοκλήρωση ΠΑΡΑΓΕΤΑΙ: έγγραφο εκδομένο από την ημέρα της πρότασης ⇒ καμία ενεργή ανάθεση', () => {
    const accepted = run(ASSIGNED);
    expect(issuanceStateOf(accepted, '2026-10-16').kind).toBe('open');
    expect(issuanceStateOf(accepted, '2026-10-17')).toEqual({ kind: 'none', last: accepted, fulfilled: true });
    // Μετά την ολοκλήρωση καμία πράξη πάνω στον παλιό κύκλο — μόνο νέα πρόταση.
    expect(reduceIssuance('energy-certificate', accepted, '2026-10-20', { kind: 'cancel', reason: 'cancelled' }, ACTOR).ok).toBe(false);
    expect(reduceIssuance('energy-certificate', accepted, '2026-10-20', PROPOSE, ACTOR).ok).toBe(true);
  });

  it('κάθε στάδιο έχει απόφαση «μπάλας» — καμία ξεχασμένη τιμή', () => {
    expect(ISSUANCE_STAGES.map((stage) => [stage, ballInCourtOf(stage)])).toEqual([
      ['proposed', 'office'], ['ownerApproved', 'office'], ['ownerRejected', null], ['sent', 'professional'],
      ['quoted', 'owner'], ['accepted', 'professional'], ['declined', 'office'], ['cancelled', null],
    ]);
  });
});

describe('ADR-915 §42 — η απόφαση κρίνει την αναθεώρηση που ΕΙΔΕ ο άνθρωπος', () => {
  it('🔴 απόφαση με παλιά (ή άγνωστη) αναθεώρηση ⇒ `terms-refused`', () => {
    const quoted = run([PROPOSE, NOTIFY, QUOTE]);
    expect(refusalOf(quoted, approve(2))).toBe('terms-refused');
    expect(refusalOf(quoted, approve(1))).toBeNull();
  });

  it('ενδεικτική: μία αναθεώρηση μετά την έγκριση ⇒ το στάδιο γυρίζει `quoted` και η παλιά έγκριση δεν ισχύει', () => {
    const approved = run([PROPOSE, NOTIFY, QUOTE_INDICATIVE, APPROVE]);
    expect(issuanceStageOf(approved)).toBe('accepted');
    const revisedTerms: QuoteTerms = { ...INDICATIVE_TERMS, amountMinor: 20_000 };
    const revised = run([PROPOSE, NOTIFY, QUOTE_INDICATIVE, APPROVE, { kind: 'quote', terms: revisedTerms }]);
    expect(issuanceStageOf(revised)).toBe('quoted');
    expect(ballInCourtOf(issuanceStageOf(revised))).toBe('owner');
    expect(revised.quote?.revision).toBe(2);
    expect(revised.quote?.amountMinor).toBe(20_000);
    expect(revised.quote?.previous?.amountMinor).toBe(10_000);
    // Η έγκριση της αναθεώρησης 1 δεν καλύπτει την 2.
    expect(refusalOf(revised, approve(1))).toBe('terms-refused');
  });

  it('ενδεικτική: νέα έγκριση της αναθεώρησης 2 ⇒ ξανά `accepted`', () => {
    const steps: IssuanceAction[] = [PROPOSE, NOTIFY, QUOTE_INDICATIVE, APPROVE, { kind: 'quote', terms: { ...INDICATIVE_TERMS, amountMinor: 20_000 } }, approve(2)];
    expect(issuanceStageOf(run(steps))).toBe('accepted');
  });

  it('🔴 δεύτερη αναθεώρηση ⇒ `terms-refused`', () => {
    const revised = run([PROPOSE, NOTIFY, QUOTE_INDICATIVE, APPROVE, { kind: 'quote', terms: INDICATIVE_TERMS }, approve(2)]);
    expect(refusalOf(revised, { kind: 'quote', terms: INDICATIVE_TERMS })).toBe('terms-refused');
  });

  it('🔴 αναθεώρηση δεσμευτικής προσφοράς ⇒ `terms-refused`', () => {
    expect(refusalOf(run(ASSIGNED), QUOTE)).toBe('terms-refused');
  });

  it('άκυροι όροι (ισχύς στο παρελθόν) ⇒ `terms-refused`', () => {
    const expired: IssuanceAction = { kind: 'quote', terms: { ...FIRM_TERMS, validUntil: '2026-10-16' } };
    expect(refusalOf(run([PROPOSE, NOTIFY]), expired)).toBe('terms-refused');
  });

  it('🔴 προσφορά σε παλιά ανάθεση (§27) ⇒ `transition-refused`', () => {
    expect(refusalOf(legacy({ notice: LEGACY_NOTICE }), QUOTE)).toBe('transition-refused');
  });

  it('«αναλαμβάνω» ΜΟΝΟ σε παλιά ανάθεση — στη ροή §42 ⇒ `transition-refused`', () => {
    const accept: IssuanceAction = { kind: 'respond', outcome: 'accepted', note: null };
    expect(refusalOf(run([PROPOSE, NOTIFY]), accept)).toBe('transition-refused');
    expect(refusalOf(run([PROPOSE, NOTIFY, QUOTE]), accept)).toBe('transition-refused');
    expect(refusalOf(legacy({ notice: LEGACY_NOTICE }), accept)).toBeNull();
  });
});

describe('ADR-915 §42 — ο σύνδεσμος του επαγγελματία προσφέρει', () => {
  const sentWithLink = run([PROPOSE, { kind: 'notify', channel: 'email', invitationId: 'inv_pro', note: null, verification: 'link' }]);
  const link = (invitationId: string): IssuanceActor => ({ kind: 'link', invitationId, verifiedBy: 'link', nowIso: '2026-10-17T10:00:00.000Z' });

  it('ο σύνδεσμος του ΤΡΕΧΟΝΤΟΣ μηνύματος καταθέτει προσφορά — υποβολή «professional-link»', () => {
    const reduced = reduceIssuance('energy-certificate', sentWithLink, null, QUOTE, link('inv_pro'));
    expect(reduced.ok && reduced.record.quote?.submission).toEqual({ by: 'professional-link', invitationId: 'inv_pro' });
    expect(reduced.ok && issuanceStageOf(reduced.record)).toBe('quoted');
  });

  it('🔴 σύνδεσμος που ΔΕΝ είναι ο τρέχων ⇒ `actor-refused`', () => {
    expect(refusalOf(sentWithLink, QUOTE, link('inv_old'))).toBe('actor-refused');
  });

  it('ο σύνδεσμος δεν καταγράφει παραστατικό — πράξη του γραφείου ⇒ `actor-refused`', () => {
    const accepted = run(ASSIGNED);
    expect(refusalOf(accepted, { kind: 'record-receipt', mark: MARK, issuedOn: '2026-10-18', totalMinor: 12_400 }, link('inv_pro'))).toBe('actor-refused');
  });
});

describe('ADR-915 §42 — το παραστατικό δένεται με την εγκεκριμένη τιμή', () => {
  const accepted = run(ASSIGNED);

  it('🔴 διαφορετικό σύνολο ⇒ `receipt-mismatch`', () => {
    expect(refusalOf(accepted, { kind: 'record-receipt', mark: MARK, issuedOn: '2026-10-18', totalMinor: 10_000 })).toBe('receipt-mismatch');
  });

  it('🔴 άκυρος ΜΑΡΚ ⇒ `receipt-mismatch`', () => {
    expect(refusalOf(accepted, { kind: 'record-receipt', mark: '1234', issuedOn: '2026-10-18', totalMinor: 12_400 })).toBe('receipt-mismatch');
  });

  it('ίδιο σύνολο (με ΦΠΑ) και έγκυρος ΜΑΡΚ ⇒ καταγράφεται', () => {
    const reduced = reduceIssuance('energy-certificate', accepted, null, { kind: 'record-receipt', mark: MARK, issuedOn: '2026-10-18', totalMinor: 12_400 }, ACTOR);
    expect(reduced.ok && reduced.record.receipt).toEqual({
      mark: MARK, issuedOn: '2026-10-18', totalMinor: 12_400, at: ACTOR.nowIso, recordedByUid: 'uid_agent',
    });
  });

  it('πριν την έγκριση (`quoted`) δεν υπάρχει εγκεκριμένη τιμή ⇒ `transition-refused`', () => {
    expect(refusalOf(run([PROPOSE, NOTIFY, QUOTE]), { kind: 'record-receipt', mark: MARK, issuedOn: '2026-10-18', totalMinor: 12_400 })).toBe('transition-refused');
  });

  it('🔴 μετά το παραστατικό δεν αναθεωρείται η προσφορά ⇒ `transition-refused`', () => {
    const receipted = run([PROPOSE, NOTIFY, QUOTE_INDICATIVE, APPROVE, { kind: 'record-receipt', mark: MARK, issuedOn: '2026-10-18', totalMinor: 12_400 }]);
    expect(refusalOf(receipted, QUOTE_INDICATIVE)).toBe('transition-refused');
  });
});

describe('ADR-915 §27 — οι παλιές αναθέσεις διαβάζονται με τους παλιούς κανόνες', () => {
  it('απόφαση χωρίς αναθεώρηση: `ownerApproved` → `sent` → `accepted`', () => {
    expect(issuanceStageOf(legacy())).toBe('ownerApproved');
    expect(issuanceStageOf(legacy({ notice: LEGACY_NOTICE }))).toBe('sent');
    const response = { basis: 'recorded', recordedByUid: 'uid_agent', outcome: 'accepted', note: null, at: ACTOR.nowIso } as const;
    expect(issuanceStageOf(legacy({ notice: LEGACY_NOTICE, response }))).toBe('accepted');
    expect(issuanceStageOf(legacy({ notice: LEGACY_NOTICE, response: { ...response, outcome: 'declined' } }))).toBe('declined');
  });

  it('απόρριψη ιδιοκτήτη (παλιά) ⇒ `ownerRejected`', () => {
    const base = legacy();
    const rejected = { ...base, decision: base.decision === null ? null : { ...base.decision, outcome: 'rejected' as const } };
    expect(issuanceStageOf(rejected)).toBe('ownerRejected');
  });

  it('η ακύρωση νικά και την παλιά ανάθεση', () => {
    expect(issuanceStageOf(legacy({ cancellation: { at: ACTOR.nowIso, byUid: 'uid_agent', reason: 'cancelled' } }))).toBe('cancelled');
  });

  it('η ενημέρωση από `ownerApproved` επιτρέπεται και δίνει `sent`', () => {
    const reduced = reduceIssuance('energy-certificate', legacy(), null, NOTIFY, ACTOR);
    expect(reduced.ok && issuanceStageOf(reduced.record)).toBe('sent');
  });
});

describe('ADR-915 §27 — προσόν ≠ επάγγελμα', () => {
  it('🔴 ΠΕΑ μόνο από εγγεγραμμένο επιθεωρητή · ταυτότητα ΟΧΙ από επιθεωρητή-άδεια μόνο', () => {
    expect(qualifiesFor('energy-certificate', 'energy-inspector-registered')).toBe(true);
    expect(qualifiesFor('energy-certificate', 'civil-engineer')).toBe(false);
    expect(qualifiesFor('building-identity', 'civil-engineer')).toBe(true);
    expect(qualifiesFor('building-identity', 'energy-inspector-registered')).toBe(false);
    expect(qualifiesFor('tax-clearance', 'civil-engineer')).toBe(false);
  });

  it('πρόταση με προσόν που ΔΕΝ υπογράφει το έγγραφο ⇒ `unqualified`', () => {
    const wrong: IssuanceAction = { ...PROPOSE, credential: { qualification: 'civil-engineer', registryNumber: null } } as IssuanceAction;
    expect(reduceIssuance('energy-certificate', null, null, wrong, ACTOR)).toEqual({ ok: false, refusal: 'unqualified' });
  });
});

describe('ADR-915 §27 — υποψήφιοι «σε γνωστό»', () => {
  const approved = (contactId: string, proposedAt: string) => ({
    ...run([{ ...PROPOSE, professional: { kind: 'contact', contactId: contactId } } as IssuanceAction, NOTIFY, QUOTE, APPROVE]),
    proposedAt,
  });
  const entry = (propertyId: string, documentKind: IssuanceRosterEntry['documentKind'], record: IssuanceAssignmentRecord) =>
    ({ propertyId, documentKind, record });
  const civil = { qualification: 'civil-engineer', registryNumber: null } as const;

  it('ο ίδιος επαγγελματίας του ΑΛΛΟΥ εγγράφου του ΙΔΙΟΥ ακινήτου έρχεται πρώτος — και λέει γιατί', () => {
    const roster = [
      entry('p9', 'energy-certificate', approved('cont_many', '2026-01-01T00:00:00.000Z')),
      entry('p8', 'energy-certificate', approved('cont_many', '2026-02-01T00:00:00.000Z')),
      // Ταυτότητα του p1 από πολιτικό μηχανικό — για ΠΕΑ θέλει δήλωση προσόντος (credential: null).
      entry('p1', 'building-identity', { ...approved('cont_same', '2025-12-01T00:00:00.000Z'), credential: civil }),
    ];
    const ranked = rankIssuanceCandidates(roster, { kind: 'energy-certificate', propertyId: 'p1', excludeContactId: null });
    expect(ranked.map((c) => [c.contactId, c.reasons.map((r) => r.kind), c.credential])).toEqual([
      ['cont_same', ['same-property'], null],
      ['cont_many', ['previously-assigned'], INSPECTOR],
    ]);
    expect(ranked[1].reasons[0]).toEqual({ kind: 'previously-assigned', count: 2, lastAt: '2026-02-01T00:00:00.000Z' });
  });

  it('🔴 μόνο ΕΓΚΕΚΡΙΜΕΝΕΣ αναθέσεις μετρούν · όποιος μόλις αρνήθηκε εξαιρείται', () => {
    const onlyProposed = run([{ ...PROPOSE, professional: { kind: 'contact', contactId: 'cont_proposed' } } as IssuanceAction]);
    const roster = [
      entry('p9', 'energy-certificate', onlyProposed),
      entry('p8', 'energy-certificate', approved('cont_declined', '2026-03-01T00:00:00.000Z')),
    ];
    expect(rankIssuanceCandidates(roster, { kind: 'energy-certificate', propertyId: 'p1', excludeContactId: 'cont_declined' })).toEqual([]);
  });
});
