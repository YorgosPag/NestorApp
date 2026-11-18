/**
 * ADR-915 §28 Η-Β1 · Η-Β2 · Η-Β3 — άγκυρες του μειωτή για τους συνδέσμους: ο σύνδεσμος **δεν** είναι εξουσία, είναι
 * ταυτότητα δεμένη στο **τρέχον** αίτημα· η βάση της απόφασης/απάντησης **παράγεται** από τον actor· ο παλιός σύνδεσμος
 * πεθαίνει από κατασκευή (νέα αποστολή · νέα πρόταση · καταγραφή του γραφείου).
 */

import {
  currentLinkAudience,
  issuanceStageOf,
  reduceIssuance,
  type IssuanceAction,
  type IssuanceActor,
  type IssuanceAssignmentRecord,
} from '@/lib/document-validity/issuance-assignment';
import { withIssuanceDelivery } from '@/lib/document-validity/issuance-delivery';

const NOW = '2026-10-17T09:00:00.000Z';
const OFFICE: IssuanceActor = { kind: 'office', uid: 'uid_agent', nowIso: NOW };
const link = (invitationId: string): IssuanceActor => ({ kind: 'link', invitationId, verifiedBy: 'link', nowIso: NOW });

const PROPOSE: IssuanceAction = {
  kind: 'propose', professional: { kind: 'contact', contactId: 'cont_pro' }, credential: { qualification: 'energy-inspector-registered', registryNumber: null },
};
const REQUEST = (invitationId: string): IssuanceAction => ({ kind: 'request-approval', invitationId, ownerContactId: 'cont_lead', note: 'σημείωση', verification: 'link' });
const LINK_APPROVE: IssuanceAction = { kind: 'decide', outcome: 'approved', channel: null, note: null, ownerContactId: 'cont_lead', quoteRevision: 1, ownerAttestation: null };
const OFFICE_APPROVE: IssuanceAction = { kind: 'decide', outcome: 'approved', channel: 'phone', note: null, ownerContactId: 'cont_lead', quoteRevision: 1, ownerAttestation: null };
const SEND = (invitationId: string | null): IssuanceAction => ({ kind: 'notify', channel: invitationId === null ? 'phone' : 'email', invitationId, note: null, verification: invitationId === null ? null : 'link' });
const LINK_DECLINE: IssuanceAction = { kind: 'respond', outcome: 'declined', note: 'δεν αναλαμβάνω' };
/** §42 — η προσφορά που ανοίγει το στάδιο `quoted`, όπου μόνο ζητείται έγκριση από τον υπεύθυνο. */
const QUOTE: IssuanceAction = {
  kind: 'quote',
  terms: { basis: 'firm', amountMinor: 10_000, vatRatePercent: 24, vatIncluded: false, validUntil: '2026-12-31', scope: ['issuance'], note: null, deliveryBusinessDays: 5, advance: null },
};
/** Πρόταση → αίτημα προσφοράς (εκτός εφαρμογής) → προσφορά ⇒ στάδιο `quoted`. */
const QUOTED: readonly (readonly [IssuanceAction, IssuanceActor?])[] = [[PROPOSE], [SEND(null)], [QUOTE]];

function step(record: IssuanceAssignmentRecord | null, action: IssuanceAction, actor: IssuanceActor = OFFICE) {
  return reduceIssuance('energy-certificate', record, null, action, actor);
}

function run(steps: readonly (readonly [IssuanceAction, IssuanceActor?])[]): IssuanceAssignmentRecord {
  let record: IssuanceAssignmentRecord | null = null;
  for (const [action, actor] of steps) {
    const reduced = step(record, action, actor);
    if (!reduced.ok) throw new Error(`${action.kind}: ${reduced.refusal}`);
    record = reduced.record;
  }
  if (record === null) throw new Error('no record');
  return record;
}

describe('ADR-915 §28 — αίτημα έγκρισης με σύνδεσμο', () => {
  it('το αίτημα ΔΕΝ αλλάζει στάδιο ούτε μπάλα: «αναμένει απόφαση» (`quoted`), και θυμάται ΠΟΙΟΣ σύνδεσμος, σε ΠΟΙΟΝ', () => {
    const record = run([...QUOTED, [REQUEST('diin_1')]]);
    expect(issuanceStageOf(record)).toBe('quoted');
    expect(record.approvalRequest).toEqual({ invitationId: 'diin_1', ownerContactId: 'cont_lead', note: 'σημείωση', at: NOW, byUid: 'uid_agent', verification: 'link', delivery: null, reminders: null });
    expect(currentLinkAudience(record, 'diin_1')).toBe('owner');
  });

  it('ο υπεύθυνος αποφασίζει με τον σύνδεσμο ⇒ βάση `owner-link-approval` + `invitationId` — ΠΟΤΕ uid γραφείου', () => {
    const reduced = step(run([...QUOTED, [REQUEST('diin_1')]]), LINK_APPROVE, link('diin_1'));
    expect(reduced.ok && reduced.record.decision).toEqual({
      basis: 'owner-link-approval', invitationId: 'diin_1', verifiedBy: 'link', outcome: 'approved', ownerContactId: 'cont_lead', quoteRevision: 1, ownerAttestation: null, note: null, at: NOW,
    });
    expect(reduced.ok && issuanceStageOf(reduced.record)).toBe('accepted');
  });

  it('🔴 επαναποστολή ⇒ ο ΠΑΛΙΟΣ σύνδεσμος πεθαίνει από κατασκευή', () => {
    const resent = run([...QUOTED, [REQUEST('diin_1')], [REQUEST('diin_2')]]);
    expect(step(resent, LINK_APPROVE, link('diin_1'))).toEqual({ ok: false, refusal: 'actor-refused' });
    expect(step(resent, LINK_APPROVE, link('diin_2')).ok).toBe(true);
  });

  it('🔴 νέα πρόταση (μετά την άρνηση του επαγγελματία) ⇒ το αίτημα σβήνει μαζί της, και ο σύνδεσμος δεν αποφασίζει πια', () => {
    const other: IssuanceAction = { ...PROPOSE, professional: { kind: 'contact', contactId: 'cont_other' } } as IssuanceAction;
    const replaced = run([...QUOTED, [REQUEST('diin_1')], [LINK_DECLINE], [other]]);
    expect(replaced.approvalRequest).toBeNull();
    expect(step(replaced, LINK_APPROVE, link('diin_1'))).toEqual({ ok: false, refusal: 'transition-refused' });
  });

  it('🔴 ενώ ο υπεύθυνος κρίνει την προσφορά, νέα πρόταση ΑΡΝΕΙΤΑΙ (τίποτα δεν αντικαθίσταται σιωπηλά)', () => {
    const other: IssuanceAction = { ...PROPOSE, professional: { kind: 'contact', contactId: 'cont_other' } } as IssuanceAction;
    expect(step(run([...QUOTED, [REQUEST('diin_1')]]), other)).toEqual({ ok: false, refusal: 'transition-refused' });
  });

  it('🔴 ο σύνδεσμος αποφασίζει ΜΟΝΟ για τον υπεύθυνο στον οποίο στάλθηκε', () => {
    const requested = run([...QUOTED, [REQUEST('diin_1')]]);
    const forOther: IssuanceAction = { ...LINK_APPROVE, ownerContactId: 'cont_someone_else' } as IssuanceAction;
    expect(step(requested, forOther, link('diin_1'))).toEqual({ ok: false, refusal: 'actor-refused' });
  });

  it('η καταγραφή του γραφείου ΚΛΕΙΝΕΙ τον σύνδεσμο (το στάδιο προχώρησε) — και η βάση της είναι η καταγραφή', () => {
    const decided = run([...QUOTED, [REQUEST('diin_1')], [OFFICE_APPROVE]]);
    expect(decided.decision?.basis).toBe('recorded-instruction');
    expect(step(decided, LINK_APPROVE, link('diin_1'))).toEqual({ ok: false, refusal: 'transition-refused' });
  });

  it('🔴 καμία βάση «με σύνδεσμο» χωρίς σύνδεσμο, και καμία καταγραφή χωρίς κανάλι', () => {
    const requested = run([...QUOTED, [REQUEST('diin_1')]]);
    expect(step(requested, LINK_APPROVE, OFFICE)).toEqual({ ok: false, refusal: 'actor-refused' });
    expect(step(requested, OFFICE_APPROVE, link('diin_1'))).toEqual({ ok: false, refusal: 'actor-refused' });
  });

  it('🔴 ο σύνδεσμος ΔΕΝ προτείνει, δεν ενημερώνει, δεν ακυρώνει, δεν ζητά έγκριση — αυτά είναι του γραφείου', () => {
    const requested = run([...QUOTED, [REQUEST('diin_1')]]);
    for (const action of [PROPOSE, SEND('diin_9'), { kind: 'cancel', reason: 'cancelled' }, REQUEST('diin_9')] as IssuanceAction[]) {
      expect(step(requested, action, link('diin_1'))).toEqual({ ok: false, refusal: 'actor-refused' });
    }
  });
});

describe('ADR-915 §28 — μήνυμα στον επαγγελματία με σύνδεσμο', () => {
  const proposed = (): IssuanceAssignmentRecord => run([[PROPOSE]]);

  it('αρνείται με τον σύνδεσμο του ΤΡΕΧΟΝΤΟΣ μηνύματος ⇒ βάση `professional-link` + η σημείωσή του', () => {
    const reduced = step(run([[PROPOSE], [SEND('diin_p1')]]), LINK_DECLINE, link('diin_p1'));
    expect(reduced.ok && reduced.record.response).toEqual({ basis: 'professional-link', invitationId: 'diin_p1', verifiedBy: 'link', outcome: 'declined', note: 'δεν αναλαμβάνω', at: NOW });
    expect(reduced.ok && issuanceStageOf(reduced.record)).toBe('declined');
  });

  it('προσφέρει με τον σύνδεσμο του ΤΡΕΧΟΝΤΟΣ μηνύματος ⇒ υποβολή `professional-link`, στάδιο `quoted`', () => {
    const reduced = step(run([[PROPOSE], [SEND('diin_p1')]]), QUOTE, link('diin_p1'));
    expect(reduced.ok && reduced.record.quote?.submission).toEqual({ by: 'professional-link', invitationId: 'diin_p1' });
    expect(reduced.ok && issuanceStageOf(reduced.record)).toBe('quoted');
  });

  it('🔴 ενημέρωση εκτός εφαρμογής (τηλέφωνο) ⇒ ΚΑΝΕΝΑΣ σύνδεσμος δεν απαντά', () => {
    const phoned = run([[PROPOSE], [SEND(null)]]);
    expect(step(phoned, LINK_DECLINE, link('diin_p1'))).toEqual({ ok: false, refusal: 'actor-refused' });
  });

  it('ξανά αποστολή από `sent` ΜΟΝΟ ως νέο μήνυμα — και ο παλιός σύνδεσμος πεθαίνει', () => {
    const sent = run([[PROPOSE], [SEND('diin_p1')]]);
    expect(step(sent, SEND(null))).toEqual({ ok: false, refusal: 'transition-refused' });
    const resent = run([[PROPOSE], [SEND('diin_p1')], [SEND('diin_p2')]]);
    expect(step(resent, LINK_DECLINE, link('diin_p1'))).toEqual({ ok: false, refusal: 'actor-refused' });
    expect(step(resent, LINK_DECLINE, link('diin_p2')).ok).toBe(true);
    expect(proposed().notice).toBeNull();
  });

  it('🔴 ο σύνδεσμος του ΙΔΙΟΚΤΗΤΗ δεν απαντά ως επαγγελματίας', () => {
    const sent = run([[PROPOSE], [SEND('diin_p1')], [QUOTE], [REQUEST('diin_owner')], [LINK_APPROVE, link('diin_owner')]]);
    expect(step(sent, LINK_DECLINE, link('diin_owner'))).toEqual({ ok: false, refusal: 'actor-refused' });
    expect(currentLinkAudience(sent, 'diin_owner')).toBe('owner');
    expect(currentLinkAudience(sent, 'diin_p1')).toBe('professional');
  });
});

describe('ADR-915 §28 Η-Β9 — η παράδοση γράφεται ΜΟΝΟ στο μήνυμα που τη γέννησε', () => {
  const delivery = { recipient: 'failed', coOwners: { cont_b: 'accepted' } } as const;

  it('στο τρέχον αίτημα ⇒ γράφεται· σε παλιό (μετά από επαναποστολή) ⇒ `null`, η νέα αναφορά δεν σκεπάζεται', () => {
    const resent = run([...QUOTED, [REQUEST('diin_1')], [REQUEST('diin_2')]]);
    expect(withIssuanceDelivery(resent, 'diin_2', delivery)?.approvalRequest?.delivery).toEqual(delivery);
    expect(withIssuanceDelivery(resent, 'diin_1', delivery)).toBeNull();
  });

  it('η παράδοση ΔΕΝ αλλάζει στάδιο', () => {
    const sent = run([[PROPOSE], [SEND('diin_p1')]]);
    const delivered = withIssuanceDelivery(sent, 'diin_p1', delivery);
    expect(delivered && issuanceStageOf(delivered)).toBe('sent');
  });
});

describe('ADR-915 §29 — ο μειωτής απαιτεί ό,τι ζήτησε το αίτημα (κωδικός πρόσβασης)', () => {
  const withCode = (invitationId: string): IssuanceActor => ({ kind: 'link', invitationId, verifiedBy: 'access-code', nowIso: NOW });
  const REQUEST_CODE = (invitationId: string): IssuanceAction => ({
    kind: 'request-approval', invitationId, ownerContactId: 'cont_lead', note: null, verification: 'access-code',
  });

  it('🔴 αίτημα με κωδικό + σύνδεσμος ΧΩΡΙΣ αποδεδειγμένο κωδικό ⇒ `actor-refused` (ακόμη κι αν η πόρτα ξεχάσει)', () => {
    const requested = run([...QUOTED, [REQUEST_CODE('diin_1')]]);
    expect(step(requested, LINK_APPROVE, link('diin_1'))).toEqual({ ok: false, refusal: 'actor-refused' });
  });

  it('με αποδεδειγμένο κωδικό ⇒ απόφαση με `verifiedBy: access-code`', () => {
    const requested = run([...QUOTED, [REQUEST_CODE('diin_1')]]);
    const reduced = step(requested, LINK_APPROVE, withCode('diin_1'));
    expect(reduced.ok && reduced.record.decision).toMatchObject({ basis: 'owner-link-approval', verifiedBy: 'access-code' });
  });

  it('αίτημα ΧΩΡΙΣ κωδικό: και ο κωδικός το καλύπτει (το ισχυρότερο καλύπτει το ασθενέστερο)', () => {
    const requested = run([...QUOTED, [REQUEST('diin_1')]]);
    expect(step(requested, LINK_APPROVE, withCode('diin_1'))).toMatchObject({ ok: true });
  });

  it('🔴 επαγγελματίας: μήνυμα με κωδικό ⇒ απάντηση χωρίς κωδικό αρνείται· η ενημέρωση τηλεφώνου ΔΕΝ γράφει «ζητήθηκε κωδικός»', () => {
    const approved = run([[PROPOSE]]);
    const sentWithCode = step(approved, { kind: 'notify', channel: 'email', invitationId: 'diin_p1', note: null, verification: 'access-code' });
    if (!sentWithCode.ok) throw new Error('not sent');
    expect(step(sentWithCode.record, LINK_DECLINE, link('diin_p1'))).toEqual({ ok: false, refusal: 'actor-refused' });
    expect(step(sentWithCode.record, LINK_DECLINE, withCode('diin_p1'))).toMatchObject({ ok: true });
    const phoned = step(approved, { kind: 'notify', channel: 'phone', invitationId: null, note: null, verification: 'access-code' });
    expect(phoned.ok && phoned.record.notice?.verification).toBeNull();
  });
});
