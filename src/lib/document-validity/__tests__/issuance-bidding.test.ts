/**
 * ADR-945 §7.2 — άγκυρες του αιτήματος προσφορών: όριο 3 · ιδεμποτία ίδιου επαγγελματία · ατομική ανάθεση (ποιες
 * κλείνουν, με ποιον λόγο) · ακύρωση · νέος κύκλος μόνο όταν ο προηγούμενος τελείωσε.
 */

import {
  ISSUANCE_REQUEST_POLICY,
  inviteCycleOf,
  reduceIssuanceRequest,
  type IssuanceRequestAction,
  type IssuanceRequestContext,
  type IssuanceRequestRecord,
} from '@/lib/document-validity/issuance-bidding';
import type { IssuanceProfessional } from '@/lib/document-validity/issuance-professional';

const CTX: IssuanceRequestContext = { uid: 'uid_private', nowIso: '2026-11-18T09:00:00.000Z', awardedBidOpen: true };
const PRO = (id: string): IssuanceProfessional => ({ kind: 'workspace', companyId: id });
const invite = (id: string, cycle = 1): IssuanceRequestAction => ({ kind: 'invite', professional: PRO(id), bidId: `bid_${cycle}_${id}` });

function run(actions: readonly IssuanceRequestAction[], ctx: IssuanceRequestContext = CTX, start: IssuanceRequestRecord | null = null): IssuanceRequestRecord {
  let record = start;
  for (const action of actions) {
    const reduced = reduceIssuanceRequest(record, action, ctx);
    if (!reduced.ok) throw new Error(`${action.kind}: ${reduced.refusal}`);
    record = reduced.record;
  }
  if (record === null) throw new Error('no record');
  return record;
}

const THREE = [invite('a'), invite('b'), invite('c')];

describe('ADR-945 §7.2 — πρόσκληση', () => {
  it('η πρώτη πρόσκληση γεννά τον κύκλο 1', () => {
    expect(run([invite('a')])).toEqual({
      cycle: 1, award: null, closure: null,
      bids: [{ bidId: 'bid_1_a', professional: PRO('a'), invitedAt: CTX.nowIso, invitedByUid: 'uid_private' }],
    });
  });

  it(`όριο ${ISSUANCE_REQUEST_POLICY.maxBids} — η τέταρτη αρνείται`, () => {
    expect(reduceIssuanceRequest(run(THREE), invite('d'), CTX)).toEqual({ ok: false, refusal: 'bid-limit' });
  });

  it('ίδιος επαγγελματίας ξανά ⇒ ιδεμποτές (`changed: false`), όχι δεύτερη προσφορά', () => {
    const once = run([invite('a')]);
    const again = reduceIssuanceRequest(once, invite('a'), CTX);
    expect(again).toEqual({ ok: true, record: once, changed: false, closing: null });
  });

  it('ίδιος επαγγελματίας, ΑΛΛΟ id προσφοράς ⇒ άρνηση (ο καλών υπολόγισε λάθος κύκλο)', () => {
    expect(reduceIssuanceRequest(run([invite('a')]), { ...invite('a'), bidId: 'bid_x' } as IssuanceRequestAction, CTX))
      .toEqual({ ok: false, refusal: 'unknown-bid' });
  });

  it('με ανοιχτή νικήτρια ⇒ καμία νέα πρόσκληση', () => {
    expect(reduceIssuanceRequest(run([...THREE.slice(0, 2), { kind: 'award', bidId: 'bid_1_a' }]), invite('c'), CTX))
      .toEqual({ ok: false, refusal: 'already-awarded' });
  });
});

describe('ADR-945 §7.2 — ανάθεση (ατομική)', () => {
  it('η νικήτρια γράφεται και οι ΑΛΛΕΣ κλείνουν ως «δεν επιλέχθηκε»', () => {
    const reduced = reduceIssuanceRequest(run(THREE), { kind: 'award', bidId: 'bid_1_b' }, CTX);
    expect(reduced).toMatchObject({
      ok: true, changed: true,
      record: { award: { bidId: 'bid_1_b', at: CTX.nowIso, byUid: 'uid_private' } },
      closing: { bidIds: ['bid_1_a', 'bid_1_c'], reason: 'not-awarded' },
    });
  });

  it('ίδια νικήτρια ξανά ⇒ ιδεμποτές · άλλη νικήτρια ⇒ άρνηση (ποτέ δύο «ανατέθηκε»)', () => {
    const awarded = run([...THREE, { kind: 'award', bidId: 'bid_1_a' }]);
    expect(reduceIssuanceRequest(awarded, { kind: 'award', bidId: 'bid_1_a' }, CTX)).toMatchObject({ ok: true, changed: false });
    expect(reduceIssuanceRequest(awarded, { kind: 'award', bidId: 'bid_1_b' }, CTX)).toEqual({ ok: false, refusal: 'already-awarded' });
  });

  it('προσφορά που δεν είναι του κύκλου ⇒ άρνηση', () => {
    expect(reduceIssuanceRequest(run(THREE), { kind: 'award', bidId: 'bid_zz' }, CTX)).toEqual({ ok: false, refusal: 'unknown-bid' });
  });

  it('χωρίς αίτημα ⇒ καμία ανάθεση, καμία ακύρωση', () => {
    expect(reduceIssuanceRequest(null, { kind: 'award', bidId: 'bid_1_a' }, CTX)).toEqual({ ok: false, refusal: 'request-closed' });
    expect(reduceIssuanceRequest(null, { kind: 'cancel' }, CTX)).toEqual({ ok: false, refusal: 'request-closed' });
  });
});

describe('ADR-945 §7.2 — ακύρωση και κύκλοι', () => {
  it('η ακύρωση κλείνει ΟΛΕΣ τις προσφορές του κύκλου, με λόγο «ακυρώθηκε»', () => {
    const reduced = reduceIssuanceRequest(run(THREE), { kind: 'cancel' }, CTX);
    expect(reduced).toMatchObject({ ok: true, changed: true, closing: { bidIds: ['bid_1_a', 'bid_1_b', 'bid_1_c'], reason: 'cancelled' } });
  });

  it('ακύρωση ξανά ⇒ ιδεμποτές', () => {
    const cancelled = run([...THREE, { kind: 'cancel' }]);
    expect(reduceIssuanceRequest(cancelled, { kind: 'cancel' }, CTX)).toMatchObject({ ok: true, changed: false, closing: null });
  });

  it('με ανοιχτή νικήτρια το αίτημα ΔΕΝ ακυρώνεται — ακυρώνεται η ίδια η ανάθεση', () => {
    const awarded = run([...THREE, { kind: 'award', bidId: 'bid_1_a' }]);
    expect(reduceIssuanceRequest(awarded, { kind: 'cancel' }, CTX)).toEqual({ ok: false, refusal: 'already-awarded' });
  });

  it('μετά την ακύρωση, νέα πρόσκληση ⇒ κύκλος 2, άδειος — ο κύκλος 1 δεν γράφεται από πάνω', () => {
    const cancelled = run([...THREE, { kind: 'cancel' }]);
    expect(inviteCycleOf(cancelled, CTX)).toBe(2);
    expect(run([invite('a', 2)], CTX, cancelled)).toMatchObject({ cycle: 2, closure: null, award: null, bids: [{ bidId: 'bid_2_a' }] });
  });

  it('νικήτρια που ΔΕΝ είναι πια ανοιχτή (εκδόθηκε) ⇒ η επόμενη πρόσκληση ανοίγει νέο κύκλο', () => {
    const awarded = run([...THREE, { kind: 'award', bidId: 'bid_1_a' }]);
    const settled = { ...CTX, awardedBidOpen: false };
    expect(inviteCycleOf(awarded, settled)).toBe(2);
    expect(reduceIssuanceRequest(awarded, { kind: 'award', bidId: 'bid_1_a' }, settled)).toEqual({ ok: false, refusal: 'request-closed' });
  });
});
