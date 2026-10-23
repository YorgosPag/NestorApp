/**
 * ADR-916 §7 Ζ17 (Φ-Δ.3 · Ο9) — **«Νέα πρόσκληση» από το γραφείο: μία κρίση για το κουμπί ΚΑΙ για την πόρτα**.
 * Καθαρές συναρτήσεις — καμία βάση. Ο πίνακας σεναρίων είναι ο **ίδιος** με της καρτέλας και της γκαλερί.
 *
 * | Μετάλλαξη | Αποτέλεσμα |
 * |---|---|
 * | η προσφορά αγνοεί τη λήξη (κάθε `issued` ⇒ `renew`) | Ζ17α «ενεργή ⇒ κανένα κουμπί» ⇒ 🔴 |
 * | η άρνηση δεν χρειάζεται επιβεβαίωση | Ζ17β ⇒ 🔴 |
 * | αποδεκτή/ακυρωμένη προσφέρει νέα | Ζ17α ⇒ 🔴 |
 * | η νέα κρατά την αφορμή της **παλιάς** | Ζ17β «αφορμή = η τρέχουσα» ⇒ 🔴 |
 */

import {
  HANDOVER_OFFICE_SCENARIOS,
  SCENARIO_NOW,
  handoverFixture,
  issuedInvitation,
} from '@/components/property-handover-office/testing/handover-office-scenarios';
import { handoverInvitationRenewalOf, handoverInvitationRenewalOfferOf } from '@/lib/property-handover/handover-invitation-plan';
import { handoverOfficeStatusOf } from '@/lib/property-handover/handover-office-status';
import type { HandoverOfficeReason, PropertyHandover } from '@/types/property-handover';

const EMAIL = 'buyer@example.test';
const EXPIRED = issuedInvitation({ expiresAt: '2026-10-20T09:00:00.000Z', occasion: 'reservation' });
const DECLINED = issuedInvitation({ declinedAt: '2026-10-03T09:00:00.000Z' });
const pending = (overrides: Partial<PropertyHandover>): PropertyHandover =>
  handoverFixture({ lifecycle: 'awaiting-completion', completion: null, recipient: null, ...overrides });

/** Οι λόγοι της καρτέλας που **είναι** «το γραφείο στέλνει νέα» — ό,τι άλλο θεραπεύεται αλλού. */
const RENEWABLE: ReadonlySet<HandoverOfficeReason> = new Set(['invitation-expired', 'declined']);

describe('Ζ17α — το κουμπί της καρτέλας ΔΕΝ μπορεί να διαφωνήσει με την πόρτα', () => {
  it.each(HANDOVER_OFFICE_SCENARIOS.map((s) => [s.id, s] as const))('%s', (_, scenario) => {
    const status = handoverOfficeStatusOf(scenario.handover, scenario.context);
    const offer = handoverInvitationRenewalOfferOf(scenario.handover, scenario.context.nowValue);
    expect(status.renewal).toBe(offer);
    expect(offer !== 'none').toBe(RENEWABLE.has(status.reason));
    // Ό,τι προσφέρει η καρτέλα, η πόρτα το εκτελεί (με επιβεβαίωση όπου τη ζητά)· ό,τι δεν προσφέρει, το αρνείται.
    const judged = handoverInvitationRenewalOf(scenario.handover, EMAIL, scenario.context.nowValue, true);
    expect(judged.kind === 'issue').toBe(offer !== 'none');
  });

  it('η άρνηση νικά τη λήξη: αρνημένη ΚΑΙ ληγμένη ⇒ θέλει επιβεβαίωση', () => {
    const both = pending({ invitation: issuedInvitation({ declinedAt: '2026-10-03T09:00:00.000Z', expiresAt: '2026-10-20T09:00:00.000Z' }) });
    expect(handoverInvitationRenewalOfferOf(both, SCENARIO_NOW)).toBe('renew-after-decline');
  });
});

describe('Ζ17β — η κρίση της ρητής πρόθεσης', () => {
  it('ληγμένη ⇒ νέα στο ΤΡΕΧΟΝ email, με την ΤΡΕΧΟΥΣΑ αφορμή (η πώληση ολοκληρώθηκε στο μεταξύ)', () => {
    const ready = handoverFixture({ recipient: null, invitation: EXPIRED });
    expect(handoverInvitationRenewalOf(ready, 'new@example.test', SCENARIO_NOW, false)).toEqual({
      kind: 'issue', email: 'new@example.test', occasion: 'completion',
    });
  });

  it('αρνημένη χωρίς επιβεβαίωση ⇒ `declined-unconfirmed` · με επιβεβαίωση ⇒ νέα', () => {
    const declined = pending({ invitation: DECLINED });
    expect(handoverInvitationRenewalOf(declined, EMAIL, SCENARIO_NOW, false)).toEqual({ kind: 'refused', reason: 'declined-unconfirmed' });
    expect(handoverInvitationRenewalOf(declined, EMAIL, SCENARIO_NOW, true)).toMatchObject({ kind: 'issue', email: EMAIL });
  });

  it('η επαφή έχασε το email ⇒ `no-address`, ποτέ πρόσκληση χωρίς παραλήπτη', () => {
    expect(handoverInvitationRenewalOf(pending({ invitation: EXPIRED }), null, SCENARIO_NOW, false)).toEqual({ kind: 'refused', reason: 'no-address' });
  });

  it.each([
    ['ενεργή', pending({ invitation: issuedInvitation() })],
    ['αποδεκτή', handoverFixture({ invitation: EXPIRED })],
    ['ακυρωμένη', pending({ lifecycle: 'cancelled', invitation: EXPIRED })],
    ['χωρίς email στην επαφή', pending({ invitation: { status: 'no-address', checkedAt: SCENARIO_NOW } })],
    ['ποτέ εκδομένη', pending({ invitation: null })],
  ])('%s ⇒ `not-renewable`', (_case, subject) => {
    expect(handoverInvitationRenewalOf(subject, EMAIL, SCENARIO_NOW, true)).toEqual({ kind: 'refused', reason: 'not-renewable' });
  });
});
