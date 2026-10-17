/**
 * ADR-915 §27 — άγκυρες της ανάθεσης έκδοσης: ο μειωτής (νόμιμες μεταβάσεις · ιδεμπότητα · «ποτέ δύο»), το στάδιο που
 * ΠΑΡΑΓΕΤΑΙ από τα γεγονότα, η μπάλα, η ολοκλήρωση από το μητρώο και η κατάταξη υποψηφίων.
 */

import {
  ISSUANCE_STAGES,
  ballInCourtOf,
  canProposeIssuance,
  issuanceStageOf,
  issuanceStateOf,
  qualifiesFor,
  rankIssuanceCandidates,
  reduceIssuance,
  type IssuanceAction,
  type IssuanceAssignmentRecord,
  type IssuanceRosterEntry,
} from '@/lib/document-validity/issuance-assignment';

const ACTOR = { uid: 'uid_agent', nowIso: '2026-10-17T09:00:00.000Z' };
const INSPECTOR = { qualification: 'energy-inspector-registered', registryNumber: 'ΥΠΕΝ-123' } as const;
const PROPOSE: IssuanceAction = { kind: 'propose', professionalContactId: 'cont_pro', credential: INSPECTOR };
const APPROVE: IssuanceAction = { kind: 'decide', outcome: 'approved', channel: 'phone', note: null, ownerContactId: 'cont_lead' };

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

describe('ADR-915 §27 — ο μειωτής', () => {
  it('ο πλήρης δρόμος: πρόταση → απόφαση → ενημέρωση → αποδοχή, και η μπάλα αλλάζει χέρια', () => {
    const steps: IssuanceAction[] = [PROPOSE, APPROVE, { kind: 'notify', channel: 'email' }, { kind: 'respond', outcome: 'accepted' }];
    const seen = steps.map((_, index) => {
      const stage = issuanceStageOf(run(steps.slice(0, index + 1)));
      return [stage, ballInCourtOf(stage)];
    });
    expect(seen).toEqual([
      ['proposed', 'owner'],
      ['ownerApproved', 'office'],
      ['sent', 'professional'],
      ['accepted', 'professional'],
    ]);
  });

  it('🔴 «Ανατέθηκε» ΜΟΝΟ με απόφαση: χωρίς απόφαση ο επαγγελματίας δεν ενημερώνεται, ούτε απαντά', () => {
    const proposed = run([PROPOSE]);
    for (const action of [{ kind: 'notify', channel: 'phone' }, { kind: 'respond', outcome: 'accepted' }] as const) {
      expect(reduceIssuance('energy-certificate', proposed, null, action, ACTOR)).toEqual({ ok: false, refusal: 'transition-refused' });
    }
  });

  it('η απόφαση γράφει ΠΟΙΟΝ ιδιοκτήτη, ΠΩΣ και ΠΟΤΕ — βάση «καταγραφή εντολής»', () => {
    expect(run([PROPOSE, APPROVE]).decision).toEqual({
      outcome: 'approved', ownerContactId: 'cont_lead', basis: 'recorded-instruction', channel: 'phone', note: null,
      recordedByUid: 'uid_agent', at: ACTOR.nowIso,
    });
  });

  it('ιδεμποτές: η ΙΔΙΑ πρόταση ξανά ⇒ `changed: false`, ίδια γεγονότα', () => {
    const proposed = run([PROPOSE]);
    expect(reduceIssuance('energy-certificate', proposed, null, PROPOSE, { ...ACTOR, nowIso: '2026-10-18T09:00:00.000Z' }))
      .toEqual({ ok: true, record: proposed, changed: false });
  });

  it('🔴 «ποτέ δύο»: μετά την έγκριση νέα πρόταση ΑΡΝΕΙΤΑΙ — πριν, αντικαθιστά (και η απόφαση ξεκινά από την αρχή)', () => {
    const other: IssuanceAction = { ...PROPOSE, professionalContactId: 'cont_other' } as IssuanceAction;
    for (const committed of [[PROPOSE, APPROVE], [PROPOSE, APPROVE, { kind: 'notify', channel: 'phone' }]] as IssuanceAction[][]) {
      expect(reduceIssuance('energy-certificate', run(committed), null, other, ACTOR)).toEqual({ ok: false, refusal: 'transition-refused' });
    }
    const replaced = reduceIssuance('energy-certificate', run([PROPOSE]), null, other, ACTOR);
    expect(replaced.ok && replaced.record.professionalContactId).toBe('cont_other');
    expect(replaced.ok && replaced.record.decision).toBeNull();
  });

  it('αρνήθηκε ⇒ η μπάλα στο γραφείο, και νέα πρόταση επιτρέπεται', () => {
    const declined = run([PROPOSE, APPROVE, { kind: 'notify', channel: 'phone' }, { kind: 'respond', outcome: 'declined' }]);
    const state = issuanceStateOf(declined, null);
    expect(state.kind === 'open' && [state.stage, state.ballInCourt]).toEqual(['declined', 'office']);
    expect(canProposeIssuance(state)).toBe(true);
  });

  it('ακύρωση και απόρριψη ιδιοκτήτη ΚΛΕΙΝΟΥΝ τον κύκλο: καμία μπάλα, νέα πρόταση ελεύθερη', () => {
    for (const closing of [[PROPOSE, { kind: 'cancel' }], [PROPOSE, { ...APPROVE, outcome: 'rejected' }]] as IssuanceAction[][]) {
      const state = issuanceStateOf(run(closing), null);
      expect(state.kind).toBe('none');
      expect(canProposeIssuance(state)).toBe(true);
    }
    expect(ballInCourtOf('cancelled')).toBeNull();
    expect(ballInCourtOf('ownerRejected')).toBeNull();
  });

  it('η ολοκλήρωση ΠΑΡΑΓΕΤΑΙ: έγγραφο εκδομένο από την ημέρα της πρότασης ⇒ καμία ενεργή ανάθεση', () => {
    const accepted = run([PROPOSE, APPROVE, { kind: 'notify', channel: 'phone' }, { kind: 'respond', outcome: 'accepted' }]);
    expect(issuanceStateOf(accepted, '2026-10-16').kind).toBe('open');
    expect(issuanceStateOf(accepted, '2026-10-17')).toEqual({ kind: 'none', last: accepted, fulfilled: true });
    // Μετά την ολοκλήρωση καμία πράξη πάνω στον παλιό κύκλο — μόνο νέα πρόταση.
    expect(reduceIssuance('energy-certificate', accepted, '2026-10-20', { kind: 'cancel' }, ACTOR).ok).toBe(false);
    expect(reduceIssuance('energy-certificate', accepted, '2026-10-20', PROPOSE, ACTOR).ok).toBe(true);
  });

  it('κάθε στάδιο έχει απόφαση «μπάλας» — καμία ξεχασμένη τιμή', () => {
    expect(ISSUANCE_STAGES.map((stage) => [stage, ballInCourtOf(stage)])).toEqual([
      ['proposed', 'owner'], ['ownerApproved', 'office'], ['ownerRejected', null], ['sent', 'professional'],
      ['accepted', 'professional'], ['declined', 'office'], ['cancelled', null],
    ]);
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
    ...run([{ ...PROPOSE, professionalContactId: contactId } as IssuanceAction, APPROVE]),
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
    const onlyProposed = run([{ ...PROPOSE, professionalContactId: 'cont_proposed' } as IssuanceAction]);
    const roster = [
      entry('p9', 'energy-certificate', onlyProposed),
      entry('p8', 'energy-certificate', approved('cont_declined', '2026-03-01T00:00:00.000Z')),
    ];
    expect(rankIssuanceCandidates(roster, { kind: 'energy-certificate', propertyId: 'p1', excludeContactId: 'cont_declined' })).toEqual([]);
  });
});
