/**
 * ADR-945 §7.6 — άγκυρες της όψης του ιδιώτη: φάση από τα γεγονότα · CAS εισόδων (κύκλος + ΟΛΑ τα στάδια) · μπάλα
 * `office` ⇒ `owner` · «κι άλλον;» από τον ΙΔΙΟ μειωτή (όχι δεύτερο όριο) · χρονολόγιο με τη σειρά του χρόνου.
 */

import type { IssuanceAssignmentRecord } from '@/lib/document-validity/issuance-assignment';
import { ISSUANCE_REQUEST_POLICY, type IssuanceBid, type IssuanceRequestRecord } from '@/lib/document-validity/issuance-bidding';
import type { IssuanceBiddingView, IssuanceBidView } from '@/lib/document-validity/issuance-bidding-request';
import type { IssuanceStage } from '@/lib/document-validity/issuance-stage';
import {
  ISSUANCE_REQUEST_KINDS,
  bidTimelineOf,
  canAwardBid,
  canCancelRequest,
  canInviteMore,
  expectedCycleOf,
  expectedStagesOf,
  inviteVerdictOf,
  ownerBallOf,
  requestPhaseOf,
} from '@/lib/document-validity/issuance-request-view-model';

const AT = '2026-11-19T09:00:00.000Z';

const bid = (companyId: string): IssuanceBid => ({
  bidId: `bid_${companyId}`, professional: { kind: 'workspace', companyId }, invitedAt: AT, invitedByUid: 'uid_owner',
});

function viewOf(
  companies: readonly string[],
  stages: readonly (IssuanceStage | null)[],
  patch: Partial<IssuanceRequestRecord> = {},
): IssuanceBiddingView {
  const request: IssuanceRequestRecord = { cycle: 1, bids: companies.map(bid), award: null, closure: null, ...patch };
  const bids: IssuanceBidView[] = companies.map((id, i) => ({ bidId: `bid_${id}`, stage: stages[i] ?? null, record: null }));
  return { request, bids };
}

const NONE: IssuanceBiddingView = { request: null, bids: [] };

describe('ADR-945 §7.6 — φάση', () => {
  it('χωρίς αίτημα ⇒ none · με προσφορές χωρίς νικήτρια ⇒ inviting', () => {
    expect(requestPhaseOf(NONE)).toBe('none');
    expect(requestPhaseOf(viewOf(['a'], ['proposed']))).toBe('inviting');
  });

  it('νικήτρια ανοιχτή ⇒ awarded · νικήτρια κλειστή (στάδιο null) ⇒ closed — η ίδια κρίση με το `awardedBidOpen`', () => {
    const award = { bidId: 'bid_a', at: AT, byUid: 'uid_owner' };
    expect(requestPhaseOf(viewOf(['a', 'b'], ['accepted', null], { award }))).toBe('awarded');
    expect(requestPhaseOf(viewOf(['a', 'b'], [null, null], { award }))).toBe('closed');
  });

  it('ακυρωμένο ⇒ closed', () => {
    expect(requestPhaseOf(viewOf(['a'], [null], { closure: { kind: 'cancelled', at: AT, byUid: 'uid_owner' } }))).toBe('closed');
  });
});

describe('ADR-945 §7.6 — CAS εισόδων', () => {
  it('ο κύκλος που φαίνεται (`null` χωρίς αίτημα) και το στάδιο ΚΑΘΕ προσφοράς', () => {
    expect(expectedCycleOf(NONE)).toBeNull();
    const view = viewOf(['a', 'b'], ['quoted', null], { cycle: 2 });
    expect(expectedCycleOf(view)).toBe(2);
    expect(expectedStagesOf(view)).toEqual({ bid_a: 'quoted', bid_b: null });
  });
});

describe('ADR-945 §7.6 — μπάλα ιδιώτη (Δ3)', () => {
  it('«Σειρά σου» μόνο με πράξη: `quoted` · `declined` — `proposed` είναι της πλατφόρμας · κλειστή ⇒ κανείς', () => {
    // Δ3: η ειδοποίηση φεύγει από την πλατφόρμα — ο ιδιώτης δεν έχει πράξη αποστολής ⇒ ΟΧΙ «Σειρά σου».
    expect(ownerBallOf('proposed')).toBe('professional');
    expect(ownerBallOf('declined')).toBe('owner');
    expect(ownerBallOf('quoted')).toBe('owner');
    expect(ownerBallOf('sent')).toBe('professional');
    expect(ownerBallOf('cancelled')).toBeNull();
    expect(ownerBallOf(null)).toBeNull();
  });
});

describe('ADR-945 §7.6 — πρόσκληση: ο ΙΔΙΟΣ μειωτής', () => {
  it(`έως ${ISSUANCE_REQUEST_POLICY.maxBids}: μετά ⇒ bid-limit, ποτέ δεύτερο όριο εδώ`, () => {
    expect(canInviteMore(NONE)).toBe(true);
    expect(canInviteMore(viewOf(['a', 'b'], ['proposed', 'proposed']))).toBe(true);
    const full = viewOf(['a', 'b', 'c'], ['proposed', 'proposed', 'proposed']);
    expect(canInviteMore(full)).toBe(false);
    expect(inviteVerdictOf(full, 'd')).toEqual({ kind: 'refused', refusal: 'bid-limit' });
  });

  it('ήδη προσκεκλημένη βιτρίνα ⇒ invited (όχι «Ζήτησε» ξανά)', () => {
    expect(inviteVerdictOf(viewOf(['a'], ['proposed']), 'a')).toEqual({ kind: 'invited' });
  });

  it('ανοιχτή νικήτρια ⇒ already-awarded · κύκλος που έκλεισε ⇒ νέα πρόσκληση επιτρέπεται', () => {
    const award = { bidId: 'bid_a', at: AT, byUid: 'uid_owner' };
    expect(inviteVerdictOf(viewOf(['a', 'b'], ['accepted', null], { award }), 'c')).toEqual({ kind: 'refused', refusal: 'already-awarded' });
    expect(inviteVerdictOf(viewOf(['a', 'b'], [null, null], { award }), 'a')).toEqual({ kind: 'can-invite' });
  });
});

describe('ADR-945 §7.6 — επιλογή · ακύρωση', () => {
  it('επιλογή μόνο σε `quoted` με τιμή, σε ζωντανό κύκλο χωρίς νικήτρια', () => {
    const view = viewOf(['a'], ['quoted']);
    expect(canAwardBid(view, view.bids[0])).toBe(false); // καμία τιμή στο record
    expect(canCancelRequest(view)).toBe(true);
    expect(canCancelRequest(NONE)).toBe(false);
  });
});

describe('ADR-945 §7.6 — είδη', () => {
  it('μόνο ό,τι εκδίδει επαγγελματίας — το ΠΕΑ μέσα, οι βεβαιώσεις αρχών έξω', () => {
    expect(ISSUANCE_REQUEST_KINDS).toContain('energy-certificate');
    expect(ISSUANCE_REQUEST_KINDS).not.toContain('tax-clearance');
  });
});

describe('ADR-945 §7.6 — χρονολόγιο', () => {
  const record: IssuanceAssignmentRecord = {
    professional: { kind: 'workspace', companyId: 'a' }, credential: { qualification: 'energy-inspector-registered', registryNumber: null },
    proposedAt: AT, proposedByUid: 'uid_owner', approvalRequest: null, decision: null,
    notice: { channel: 'email', at: '2026-11-19T10:00:00.000Z', byUid: 'uid_owner', invitationId: null, verification: null, note: null, delivery: null, reminders: null },
    response: null, quote: null, receipt: null, deliverySchedule: [], deliveryReminders: null, inspectionContacts: [], deliveryChangeRequests: [],
    advanceEvents: [], advanceReceipt: null,
    cancellation: { at: '2026-11-20T09:00:00.000Z', byUid: 'uid_owner', reason: 'not-awarded' },
  };

  it('από τα γεγονότα, με τη σειρά του χρόνου — «δεν επιλέχθηκε» ≠ «ακυρώθηκε»', () => {
    expect(bidTimelineOf(record).map((entry) => entry.kind)).toEqual(['requested', 'sent', 'not-awarded']);
  });
});
