/**
 * @fileoverview **«Μπορεί το γραφείο να ανακαλέσει αυτή την παράδοση — και τι γίνεται αν το κάνει;»** (ADR-916 §5.19 Φ-Δ.5 · Δ8 · Ο4).
 * @related handover-office-status.ts (η κρίση της καρτέλας — **συνθέτει** αυτή την προσφορά) ·
 *          services/property-handover/property-handover-write.service.ts (ο ΕΝΑΣ γραφέας — την ξανατρέχει ΜΕΣΑ στη συναλλαγή)
 * @module lib/property-handover/handover-withdrawal-plan
 *
 * 🔑 **Μία κρίση για κουμπί ΚΑΙ πόρτα** (πρότυπο Φ-Δ.3/Φ-Δ.4): το κουμπί εμφανίζεται μόνο όταν η πόρτα θα δεχτεί.
 *
 * ⚖️ **Όρια, από τους μεγάλους**:
 *   1. **Μόνο ό,τι η μηχανή επιβεβαιώνει ως αντίφαση** (Ο4): ολοκληρωμένη παράδοση **και** η πώληση δεν ισχύει πια γι' αυτόν
 *      τον αγοραστή. Το DocuSign επιτρέπει void σε κάθε εκκρεμή φάκελο· εδώ κανείς δεν μπορεί να «κόψει» κατά λάθος έναν
 *      νόμιμο αγοραστή — πρώτα πρέπει να αλλάξει η αλήθεια της πώλησης, που έχει τον δικό της κάτοχο.
 *   2. **Τερματικό** (DocuSign: το void δεν αναιρείται): η συμφιλίωση δεν το αλλάζει ποτέ (`planPropertyHandovers`).
 *   3. **Ό,τι παραδόθηκε μένει** (Δ2 · Δ5): η ανάκληση **δεν** σβήνει τίποτα — σταματά ό,τι **θα** γινόταν.
 *   4. **Ιδεμπότητα**: δεύτερη ανάκληση (διπλό κλικ · επανάληψη δικτύου) ⇒ `unchanged`, ποτέ δεύτερο email.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις· ο χρόνος **δίνεται**, δεν διαβάζεται.
 */

import {
  HANDOVER_WITHDRAWAL_NOTICE_CAP,
  isHandoverWithdrawalNoticeAbandoned,
} from '@/config/property-handover-withdrawal-policy';
import type {
  HandoverWithdrawalOffer,
  HandoverWithdrawalRefusal,
  PropertyHandover,
  PropertyHandoverWithdrawal,
} from '@/types/property-handover';

import type { PropertyHandoverSnapshot, PropertyHandoverWrite } from './handover-plan';

/** Η πώληση **τώρα**, όσο χρειάζεται η κρίση — `null` ⇒ το ακίνητο δεν διαβάζεται (καμία υπόθεση). */
export type HandoverSaleTruth = Pick<PropertyHandoverSnapshot, 'open' | 'recipientContactIds'> | null;

/** Ο4 — `ready` είναι κολλώδες· αν η πώληση έπεσε ή ο αγοραστής αφαιρέθηκε **μετά**, το κρίνει άνθρωπος. */
export function saleRevertedAfterCompletion(handover: PropertyHandover, sale: HandoverSaleTruth): boolean {
  if (handover.lifecycle !== 'ready' || sale === null) return false;
  return !sale.open || !sale.recipientContactIds.includes(handover.recipientContactId);
}

/** Η επαφή είναι **ξανά** αγοραστής μιας ανακλημένης παράδοσης — σήμα στο γραφείο (η επαναφορά είναι ρητή πράξη, Ο21). */
export function buyerAgainAfterWithdrawal(handover: PropertyHandover, sale: HandoverSaleTruth): boolean {
  if (handover.lifecycle !== 'withdrawn' || sale === null) return false;
  return sale.open && sale.recipientContactIds.includes(handover.recipientContactId);
}

/** **Το κουμπί ΚΑΙ η πόρτα** — η μία απάντηση στο «μπορεί το γραφείο να ανακαλέσει;». */
export function handoverWithdrawalOfferOf(handover: PropertyHandover, sale: HandoverSaleTruth): HandoverWithdrawalOffer {
  return saleRevertedAfterCompletion(handover, sale) ? 'withdraw' : 'none';
}

export interface HandoverWithdrawalInput {
  readonly reason: string;
  /** uid του ανθρώπου του γραφείου. */
  readonly performedBy: string;
  readonly nowValue: string;
}

export type HandoverWithdrawalVerdict =
  | { readonly kind: 'apply'; readonly after: PropertyHandover }
  | { readonly kind: 'unchanged' }
  | { readonly kind: 'refused'; readonly reason: Extract<HandoverWithdrawalRefusal, 'not-withdrawable'> };

/**
 * **Η κρίση της πόρτας** — την ξανατρέχει ο γραφέας **μέσα** στη συναλλαγή, πάνω στο φρέσκο στιγμιότυπο. Ιδεμπότητα
 * **πριν** από την άρνηση: μια επανάληψη μετά από επιτυχία πρέπει να πάρει «καμία αλλαγή», όχι «δεν ανακαλείται».
 */
export function handoverWithdrawalOf(
  handover: PropertyHandover,
  sale: HandoverSaleTruth,
  input: HandoverWithdrawalInput,
): HandoverWithdrawalVerdict {
  if (handover.lifecycle === 'withdrawn') return { kind: 'unchanged' };
  if (handoverWithdrawalOfferOf(handover, sale) === 'none') return { kind: 'refused', reason: 'not-withdrawable' };
  const withdrawal: PropertyHandoverWithdrawal = {
    reason: input.reason.trim(),
    withdrawnBy: input.performedBy,
    withdrawnAt: input.nowValue,
    // Μόνο όποιος **αποδέχτηκε** έχει φάκελο και λογαριασμό· ο σύνδεσμος του άλλου απλώς πεθαίνει (ανάκληση πρόσκλησης).
    notice: handover.recipient === null ? null : { delivery: 'pending', attempts: 0 },
  };
  return { kind: 'apply', after: { ...handover, lifecycle: 'withdrawn', withdrawal, updatedAt: input.nowValue } };
}

/** Η έκβαση της ρητής πρόθεσης, όπως τη λέει ο γραφέας στην πόρτα. */
export type HandoverWithdrawalOutcome =
  | { readonly kind: 'withdrawn' | 'unchanged' }
  | { readonly kind: 'refused'; readonly reason: HandoverWithdrawalRefusal };

export interface HandoverWithdrawalApplication {
  /** Το σχέδιο της συμφιλίωσης **με** τη μετάβαση της ανάκλησης (μία εγγραφή ανά παράδοση). */
  readonly writes: readonly PropertyHandoverWrite[];
  readonly outcome: HandoverWithdrawalOutcome;
}

/**
 * **Η ανάκληση πάνω στο σχέδιο της συμφιλίωσης** — η μετάβαση μπαίνει στις **ίδιες** εγγραφές, άρα ίδιο ίχνος, ίδια προβολή
 * στον φάκελο του αγοραστή, ίδια συναλλαγή με την ανάκληση της πρόσκλησης.
 */
export function applyHandoverWithdrawal(
  planned: readonly PropertyHandoverWrite[],
  existing: readonly PropertyHandover[],
  sale: HandoverSaleTruth,
  request: { readonly handoverId: string } & HandoverWithdrawalInput,
): HandoverWithdrawalApplication {
  const before = existing.find((handover) => handover.id === request.handoverId) ?? null;
  const current = planned.find((write) => write.after.id === request.handoverId)?.after ?? before;
  if (current === null) return { writes: planned, outcome: { kind: 'refused', reason: 'handover-unknown' } };
  const verdict = handoverWithdrawalOf(current, sale, request);
  if (verdict.kind !== 'apply') return { writes: planned, outcome: verdict.kind === 'unchanged' ? { kind: 'unchanged' } : verdict };
  const write: PropertyHandoverWrite = before === null ? { kind: 'create', after: verdict.after } : { kind: 'update', before, after: verdict.after };
  return { writes: [...planned.filter((entry) => entry.after.id !== request.handoverId), write], outcome: { kind: 'withdrawn' } };
}

// =============================================================================
// Η ΕΙΔΟΠΟΙΗΣΗ ΤΟΥ ΑΓΟΡΑΣΤΗ — μετά το commit, με δίχτυ
// =============================================================================

/**
 * **Οφείλεται ακόμη email;** — η ΜΙΑ απάντηση: την αποθηκεύει ο σειριοποιητής ως `withdrawalNoticeState` (παράγωγο, για το
 * ερώτημα ισότητας του διχτυού) και τη ρωτούν ο γραφέας και το δίχτυ. Το `no-address` **δεν** ξαναδοκιμάζεται (δεν θα
 * εμφανιστεί μόνο του)· το `failed` ξαναδοκιμάζεται ως το όριο.
 */
export function withdrawalNoticeDueOf(handover: Pick<PropertyHandover, 'lifecycle' | 'withdrawal'>): boolean {
  const notice = handover.withdrawal?.notice ?? null;
  if (handover.lifecycle !== 'withdrawn' || notice === null) return false;
  return (notice.delivery === 'pending' || notice.delivery === 'failed') && notice.attempts < HANDOVER_WITHDRAWAL_NOTICE_CAP;
}

/**
 * **Να ξαναδοκιμάσει το δίχτυ τώρα;** — ένα `pending` ξαναστέλνεται **μόνο** αφού περάσει η χάρη (αλλιώς η πράξη του
 * γραφείου μπορεί να στέλνει ακόμη ⇒ διπλό email).
 */
export function withdrawalNoticeRetryDueOf(handover: Pick<PropertyHandover, 'lifecycle' | 'withdrawal'>, nowValue: string): boolean {
  const withdrawal = handover.withdrawal;
  if (withdrawal === null || !withdrawalNoticeDueOf(handover)) return false;
  return withdrawal.notice?.delivery === 'failed' || isHandoverWithdrawalNoticeAbandoned(withdrawal.withdrawnAt, nowValue);
}

/** Η ειδοποίηση **δεν θα φτάσει** χωρίς άνθρωπο — σήμα στην καρτέλα. */
export function withdrawalNoticeUndelivered(handover: Pick<PropertyHandover, 'lifecycle' | 'withdrawal'>): boolean {
  const notice = handover.withdrawal?.notice ?? null;
  if (handover.lifecycle !== 'withdrawn' || notice === null || notice.delivery === 'accepted') return false;
  return !withdrawalNoticeDueOf(handover);
}
