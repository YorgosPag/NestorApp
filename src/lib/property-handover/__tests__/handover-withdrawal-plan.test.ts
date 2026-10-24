/**
 * ADR-916 §5.19 Φ-Δ.5 — άγκυρες Ζ35–Ζ40: η καθαρή κρίση της «Ανάκλησης παράδοσης».
 */

import {
  applyHandoverWithdrawal,
  buyerAgainAfterWithdrawal,
  handoverWithdrawalOf,
  handoverWithdrawalOfferOf,
  saleRevertedAfterCompletion,
  withdrawalNoticeDueOf,
  withdrawalNoticeRetryDueOf,
  withdrawalNoticeUndelivered,
  type HandoverSaleTruth,
} from '@/lib/property-handover/handover-withdrawal-plan';
import { HANDOVER_WITHDRAWAL_NOTICE_CAP } from '@/config/property-handover-withdrawal-policy';
import {
  HANDOVER_OFFICE_SCENARIOS,
  handoverFixture,
  issuedInvitation,
} from '@/components/property-handover-office/testing/handover-office-scenarios';
import {
  handoverInvitationFollowUpOf,
  handoverInvitationIntentOf,
  handoverInvitationRenewalOfferOf,
} from '@/lib/property-handover/handover-invitation-plan';
import { handoverOfficeStatusOf } from '@/lib/property-handover/handover-office-status';
import { isClosedHandoverLifecycle, planPropertyHandovers, type PropertyHandoverSnapshot } from '@/lib/property-handover/handover-plan';
import { propertyHandoverFromDocument } from '@/lib/property-handover/property-handover-from-document';
import type { PropertyHandover, PropertyHandoverWithdrawal } from '@/types/property-handover';

const NOW = '2026-10-23T10:00:00.000Z';
const REVERTED: HandoverSaleTruth = { open: false, recipientContactIds: [] };
const BUYER_REMOVED: HandoverSaleTruth = { open: true, recipientContactIds: ['cont_other'] };
const OPEN: HandoverSaleTruth = { open: true, recipientContactIds: ['cont_buyer'] };
const INPUT = { reason: '  Η πώληση ακυρώθηκε δικαστικά  ', performedBy: 'uid_office', nowValue: NOW };

const withdrawn = (notice: PropertyHandoverWithdrawal['notice'], withdrawnAt = NOW): PropertyHandover => handoverFixture({
  lifecycle: 'withdrawn',
  withdrawal: { reason: 'Η πώληση ακυρώθηκε', withdrawnBy: 'uid_office', withdrawnAt, notice },
});

describe('Ζ35 — η προσφορά: μόνο ό,τι η μηχανή επιβεβαιώνει ως αντίφαση (Ο4)', () => {
  it('ολοκληρωμένη + η πώληση έπεσε ⇒ withdraw', () => {
    expect(handoverWithdrawalOfferOf(handoverFixture(), REVERTED)).toBe('withdraw');
  });
  it('ολοκληρωμένη + ο αγοραστής αφαιρέθηκε ⇒ withdraw', () => {
    expect(handoverWithdrawalOfferOf(handoverFixture(), BUYER_REMOVED)).toBe('withdraw');
  });
  it('ολοκληρωμένη + η πώληση ισχύει ⇒ none (κανείς δεν «κόβει» νόμιμο αγοραστή)', () => {
    expect(handoverWithdrawalOfferOf(handoverFixture(), OPEN)).toBe('none');
  });
  it('ακίνητο που δεν διαβάζεται ⇒ none (καμία υπόθεση)', () => {
    expect(handoverWithdrawalOfferOf(handoverFixture(), null)).toBe('none');
  });
  it.each(['awaiting-completion', 'cancelled', 'withdrawn'] as const)('%s ⇒ none (πριν την ολοκλήρωση η πώληση που πέφτει = cancelled)', (lifecycle) => {
    expect(handoverWithdrawalOfferOf(handoverFixture({ lifecycle }), REVERTED)).toBe('none');
  });
  it('το Ο4 είναι ΑΚΡΙΒΩΣ η προσφορά', () => {
    for (const sale of [REVERTED, BUYER_REMOVED, OPEN, null]) {
      expect(handoverWithdrawalOfferOf(handoverFixture(), sale) === 'withdraw').toBe(saleRevertedAfterCompletion(handoverFixture(), sale));
    }
  });
});

describe('Ζ36 — η κρίση της πόρτας', () => {
  it('apply: τερματικό, με αιτιολογία καθαρισμένη, δρώντα, στιγμή, και ειδοποίηση που οφείλεται', () => {
    const verdict = handoverWithdrawalOf(handoverFixture(), REVERTED, INPUT);
    expect(verdict).toEqual({
      kind: 'apply',
      after: expect.objectContaining({
        lifecycle: 'withdrawn', updatedAt: NOW,
        withdrawal: { reason: 'Η πώληση ακυρώθηκε δικαστικά', withdrawnBy: 'uid_office', withdrawnAt: NOW, notice: { delivery: 'pending', attempts: 0 } },
      }),
    });
  });
  it('ΤΙΠΟΤΑ από όσα παραδόθηκαν δεν αλλάζει (Δ2 · Δ5): παραλήπτης · πρόοδος · Πρωτόκολλο μένουν', () => {
    const before = handoverFixture();
    const verdict = handoverWithdrawalOf(before, REVERTED, INPUT);
    if (verdict.kind !== 'apply') throw new Error('αναμενόταν apply');
    expect(verdict.after.recipient).toBe(before.recipient);
    expect(verdict.after.fileDelivery).toBe(before.fileDelivery);
    expect(verdict.after.protocol).toBe(before.protocol);
  });
  it('χωρίς αποδοχή ⇒ καμία ειδοποίηση (δεν υπάρχει φάκελος· ο σύνδεσμος απλώς πεθαίνει)', () => {
    const verdict = handoverWithdrawalOf(handoverFixture({ recipient: null }), REVERTED, INPUT);
    expect(verdict.kind === 'apply' && verdict.after.withdrawal?.notice).toBeNull();
  });
  it('ιδεμπότητα ΠΡΙΝ την άρνηση: ήδη ανακλημένη ⇒ unchanged', () => {
    expect(handoverWithdrawalOf(withdrawn(null), REVERTED, INPUT)).toEqual({ kind: 'unchanged' });
    expect(handoverWithdrawalOf(withdrawn(null), OPEN, INPUT)).toEqual({ kind: 'unchanged' });
  });
  it('η πώληση ισχύει ⇒ not-withdrawable', () => {
    expect(handoverWithdrawalOf(handoverFixture(), OPEN, INPUT)).toEqual({ kind: 'refused', reason: 'not-withdrawable' });
  });
});

describe('Ζ37 — πάνω στο σχέδιο της συμφιλίωσης', () => {
  it('μία εγγραφή update με το πριν — ίδιο ίχνος, ίδια προβολή', () => {
    const before = handoverFixture();
    const applied = applyHandoverWithdrawal([], [before], REVERTED, { handoverId: before.id, ...INPUT });
    expect(applied.outcome).toEqual({ kind: 'withdrawn' });
    expect(applied.writes).toEqual([expect.objectContaining({ kind: 'update', before, after: expect.objectContaining({ lifecycle: 'withdrawn' }) })]);
  });
  it('άγνωστη παράδοση ⇒ handover-unknown, το σχέδιο αμετάβλητο', () => {
    const applied = applyHandoverWithdrawal([], [handoverFixture()], REVERTED, { handoverId: 'phov_other', ...INPUT });
    expect(applied).toEqual({ writes: [], outcome: { kind: 'refused', reason: 'handover-unknown' } });
  });
  it('άρνηση ⇒ το σχέδιο αμετάβλητο', () => {
    const applied = applyHandoverWithdrawal([], [handoverFixture()], OPEN, { handoverId: 'phov_demo', ...INPUT });
    expect(applied).toEqual({ writes: [], outcome: { kind: 'refused', reason: 'not-withdrawable' } });
  });
});

describe('Ζ38 — η ειδοποίηση: οφείλεται · ξαναδοκιμάζεται · σήμα', () => {
  it('pending/failed κάτω από το όριο ⇒ οφείλεται· accepted · no-address · όριο ⇒ όχι', () => {
    expect(withdrawalNoticeDueOf(withdrawn({ delivery: 'pending', attempts: 0 }))).toBe(true);
    expect(withdrawalNoticeDueOf(withdrawn({ delivery: 'failed', attempts: 1 }))).toBe(true);
    expect(withdrawalNoticeDueOf(withdrawn({ delivery: 'accepted', attempts: 1 }))).toBe(false);
    expect(withdrawalNoticeDueOf(withdrawn({ delivery: 'no-address', attempts: 1 }))).toBe(false);
    expect(withdrawalNoticeDueOf(withdrawn({ delivery: 'failed', attempts: HANDOVER_WITHDRAWAL_NOTICE_CAP }))).toBe(false);
    expect(withdrawalNoticeDueOf(withdrawn(null))).toBe(false);
  });
  it('το δίχτυ ΔΕΝ ξαναστέλνει pending μέσα στη χάρη (διπλό email) — μετά ναι· failed αμέσως', () => {
    expect(withdrawalNoticeRetryDueOf(withdrawn({ delivery: 'pending', attempts: 0 }, NOW), '2026-10-23T10:05:00.000Z')).toBe(false);
    expect(withdrawalNoticeRetryDueOf(withdrawn({ delivery: 'pending', attempts: 0 }, NOW), '2026-10-23T10:20:00.000Z')).toBe(true);
    expect(withdrawalNoticeRetryDueOf(withdrawn({ delivery: 'failed', attempts: 1 }, NOW), '2026-10-23T10:01:00.000Z')).toBe(true);
  });
  it('σήμα «δεν έφτασε»: no-address · failed στο όριο — ποτέ όσο ξαναδοκιμάζεται ή αφού έφτασε', () => {
    expect(withdrawalNoticeUndelivered(withdrawn({ delivery: 'no-address', attempts: 1 }))).toBe(true);
    expect(withdrawalNoticeUndelivered(withdrawn({ delivery: 'failed', attempts: HANDOVER_WITHDRAWAL_NOTICE_CAP }))).toBe(true);
    expect(withdrawalNoticeUndelivered(withdrawn({ delivery: 'failed', attempts: 1 }))).toBe(false);
    expect(withdrawalNoticeUndelivered(withdrawn({ delivery: 'accepted', attempts: 1 }))).toBe(false);
    expect(withdrawalNoticeUndelivered(withdrawn(null))).toBe(false);
  });
});

describe('Ζ39 — ξανά αγοραστής μετά την ανάκληση: σήμα, όχι ανάσταση (Ο21)', () => {
  it('η επαφή ξαναγίνεται αγοραστής ⇒ σήμα', () => {
    expect(buyerAgainAfterWithdrawal(withdrawn(null), OPEN)).toBe(true);
    expect(buyerAgainAfterWithdrawal(withdrawn(null), REVERTED)).toBe(false);
    expect(buyerAgainAfterWithdrawal(handoverFixture(), OPEN)).toBe(false);
  });
});

describe('Ζ40 — κουμπί = πόρτα σε ΚΑΘΕ σενάριο της καρτέλας', () => {
  it.each(HANDOVER_OFFICE_SCENARIOS.map((entry) => [entry.id, entry] as const))('%s', (_id, entry) => {
    const status = handoverOfficeStatusOf(entry.handover, entry.context);
    expect(status.withdrawal).toBe(handoverWithdrawalOfferOf(entry.handover, entry.context.snapshot));
    // Το κουμπί υπάρχει ΑΚΡΙΒΩΣ εκεί όπου η κρίση λέει Ο4.
    expect(status.withdrawal === 'withdraw').toBe(status.reason === 'sale-reverted');
    // Η πόρτα δεν αρνείται ποτέ ό,τι υπόσχεται το κουμπί (και το αντίστροφο).
    const verdict = handoverWithdrawalOf(entry.handover, entry.context.snapshot, INPUT);
    if (status.withdrawal === 'withdraw') expect(verdict.kind).toBe('apply');
    else expect(verdict.kind).not.toBe('apply');
  });
});

describe('Ζ41 — τερματικό: η συμφιλίωση δεν ανασταίνει ποτέ μια ανακλημένη', () => {
  const snapshot = (open: boolean, completed: boolean): PropertyHandoverSnapshot => ({
    companyId: 'comp_demo', propertyId: 'prop_demo', open, completed, recipientContactIds: open ? ['cont_buyer'] : [],
  });
  it.each([[true, true], [true, false], [false, false]])('open=%s completed=%s ⇒ καμία εγγραφή', (open, completed) => {
    expect(planPropertyHandovers(snapshot(open, completed), [withdrawn(null)], NOW)).toEqual([]);
  });
});

describe('Ζ42 — η πρόσκληση μιας ανακλημένης: ανάκληση, ποτέ νέα, ποτέ υπενθύμιση, ποτέ αποδοχή', () => {
  const open = handoverFixture({ lifecycle: 'withdrawn', recipient: null, invitation: issuedInvitation({ delivery: 'failed' }) });
  it('ζωντανή πρόσκληση ⇒ revoke (ο σύνδεσμος πεθαίνει)', () => {
    expect(handoverInvitationIntentOf(open, 'buyer@example.test')).toEqual({ kind: 'revoke' });
  });
  it('καμία «Νέα πρόσκληση» · κανένα email διχτυού', () => {
    expect(handoverInvitationRenewalOfferOf(handoverFixture({ ...open, invitation: issuedInvitation({ declinedAt: NOW }) }), NOW)).toBe('none');
    expect(handoverInvitationFollowUpOf(open, NOW)).toBe('none');
  });
  it('κλειστή = ακυρωμένη ή ανακλημένη — τίποτε άλλο', () => {
    expect(['awaiting-completion', 'ready', 'cancelled', 'withdrawn'].filter((lifecycle) => isClosedHandoverLifecycle(lifecycle as PropertyHandover['lifecycle'])))
      .toEqual(['cancelled', 'withdrawn']);
  });
});

describe('Ζ43 — ο αναγνώστης: η ανάκληση υπάρχει μόνο σε ανακλημένη', () => {
  const stored = (lifecycle: string, withdrawal: unknown) => ({
    companyId: 'comp_demo', propertyId: 'prop_demo', recipientContactId: 'cont_buyer', lifecycle, withdrawal,
    createdAt: NOW, updatedAt: NOW,
  });
  const valid = { reason: 'Η πώληση ακυρώθηκε', withdrawnBy: 'uid_office', withdrawnAt: NOW, notice: { delivery: 'failed', attempts: 2 } };
  it('ανακλημένη ⇒ διαβάζεται πεδίο προς πεδίο', () => {
    expect(propertyHandoverFromDocument(stored('withdrawn', valid), 'phov_demo')?.withdrawal).toEqual(valid);
  });
  it('πεδίο σε άλλη κατάσταση ⇒ αλλοίωση, όχι ανάκληση', () => {
    expect(propertyHandoverFromDocument(stored('ready', valid), 'phov_demo')?.withdrawal).toBeNull();
  });
  it('άγνωστη έκβαση ειδοποίησης ⇒ notice null (ποτέ δεύτερο email από χαλασμένο πεδίο)', () => {
    const doc = stored('withdrawn', { ...valid, notice: { delivery: 'sent', attempts: 1 } });
    expect(propertyHandoverFromDocument(doc, 'phov_demo')?.withdrawal?.notice).toBeNull();
  });
  it('χωρίς αιτιολογία ⇒ καμία εφεύρεση (null), ο κύκλος ζωής μένει', () => {
    const read = propertyHandoverFromDocument(stored('withdrawn', { ...valid, reason: '' }), 'phov_demo');
    expect(read?.lifecycle).toBe('withdrawn');
    expect(read?.withdrawal).toBeNull();
  });
});
