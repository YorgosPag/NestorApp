/**
 * =============================================================================
 * Μητρώο λήξεων — Η ΠΡΟΚΑΤΑΒΟΛΗ της ανάθεσης με κράτηση (ADR-943)
 * =============================================================================
 *
 * **«Πόση προκαταβολή, με ποια πολιτική ακύρωσης — και πού βρίσκονται τα χρήματα τώρα;»** Ο μηχανικός ζητά προκαταβολή
 * **μέσα στην προσφορά** του (ADR-943 Κ-3)· ο ιδιοκτήτης την εγκρίνει μαζί με τιμή και πρόσωπο· πληρώνει· ο πάροχος
 * (EveryPay Marketplace) **κρατά** τα χρήματα· στην **έναρξη** (αυτοψία) ανοίγει παράθυρο αντίρρησης και μετά αποδεσμεύονται
 * στον μηχανικό (Κ-4, πρακτική Airbnb).
 *
 * 🔑 **Αίτημα πληρωμής, όχι τιμολόγιο** (Κ-1, ΚΦΑ 16 §2β): εδώ δεν υπάρχει παραστατικό. Ο ΜΑΡΚ της προκαταβολής
 *    καταγράφεται **μετά** την είσπραξη και πρέπει να ισούται με ό,τι εισπράχθηκε (Κ-7).
 * 🔑 **Η κατάσταση ΠΑΡΑΓΕΤΑΙ από τα γεγονότα** (`advanceEvents`), όπως το στάδιο της ανάθεσης: κανένα πεδίο «κατάσταση».
 *    Τα γεγονότα χρημάτων (`funded` · `released` · `refunded`) τα γράφει **μόνο** ο actor `system` μετά από ανάγνωση της
 *    αλήθειας στο API του παρόχου (Κ-8)· ο άνθρωπος γράφει μόνο **προθέσεις** (`work-started` · `start-objected`).
 * 🔑 **Πριν από την έναρξη, πάντα πλήρης επιστροφή** (Κ-5). Μετά, κατά την τυποποιημένη πολιτική.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, μηδέν I/O.
 *
 * @module lib/document-validity/issuance-advance
 */

import { isMinorAmount, type MinorAmount } from '@/lib/money/money';

import { agreedQuoteOf, quoteTotalsOf, type QuoteAgreementFacts } from './issuance-quote';

// ---------------------------------------------------------------------------
// Οι όροι
// ---------------------------------------------------------------------------

/** Οι τυποποιημένες πολιτικές ακύρωσης (Κ-5) — κλειστό λεξιλόγιο, ποτέ ελεύθερο κείμενο. */
export const CANCELLATION_POLICIES = ['flexible', 'moderate', 'strict'] as const;
export type CancellationPolicyId = (typeof CANCELLATION_POLICIES)[number];

/**
 * Τι ποσοστό της προκαταβολής **κρατά** ο μηχανικός αν η ανάθεση ακυρωθεί **μετά** την έναρξη. Πριν την έναρξη: 0 για
 * όλες (Κ-5). ⚠️ Οι τιμές είναι πρόταση του ADR-943 §4 προς επιβεβαίωση Giorgio — ζουν **μόνο** εδώ.
 */
export const RETAINED_AFTER_START_PERCENT: Readonly<Record<CancellationPolicyId, number>> = {
  flexible: 0,
  moderate: 50,
  strict: 100,
};

/** Τα όρια — ΕΝΑ σημείο. */
export const ADVANCE_POLICY = {
  /** Κ-4: ώρες αντίρρησης του ιδιοκτήτη μετά τη δήλωση έναρξης. */
  objectionWindowHours: 48,
  /** Μέγιστο μήκος αιτιολογίας αντίρρησης — αμυντικά, όπως το `ISSUANCE_NOTE_MAX`. */
  objectionReasonMax: 500,
  /** Αμυντικό φρένο του ιστορικού γεγονότων — όχι πολιτική. */
  maxEvents: 30,
} as const;

/** Η προκαταβολή μέσα στους όρους της προσφοράς — ποσό σε λεπτά (μέρος του **συνόλου** με ΦΠΑ) και πολιτική. */
export interface AdvanceTerms {
  readonly amountMinor: MinorAmount;
  readonly policy: CancellationPolicyId;
}

export function isCancellationPolicy(value: string): value is CancellationPolicyId {
  return (CANCELLATION_POLICIES as readonly string[]).includes(value);
}

/** Αποδεκτή προκαταβολή; — θετικό ακέραιο ποσό, **όχι** πάνω από το σύνολο της προσφοράς, γνωστή πολιτική. */
export function isAdvanceTermsValid(advance: AdvanceTerms, totalMinor: MinorAmount): boolean {
  return isMinorAmount(advance.amountMinor) && advance.amountMinor > 0 && advance.amountMinor <= totalMinor
    && isCancellationPolicy(advance.policy);
}

// ---------------------------------------------------------------------------
// Τα γεγονότα
// ---------------------------------------------------------------------------

/** Ποιος έφερε την αντίρρηση — το γραφείο (καταγραφή) ή ο ίδιος ο ιδιοκτήτης με σύνδεσμο. */
export type StartObjectionBy =
  | { readonly by: 'office'; readonly uid: string }
  | { readonly by: 'owner-link'; readonly invitationId: string };

/** Γιατί αποδεσμεύτηκαν: πέρασε το παράθυρο χωρίς αντίρρηση, ή αποφάσισε το γραφείο μετά από αντίρρηση. */
export const ADVANCE_RELEASE_BASES = ['window-elapsed', 'office-resolution'] as const;
export type AdvanceReleaseBasis = (typeof ADVANCE_RELEASE_BASES)[number];

export type AdvanceEvent =
  /** Ο πάροχος βεβαίωσε την πληρωμή (API, όχι webhook). `withdrawalWaiverAt` = Κ-6: ρητό αίτημα έναρξης πριν τις 14 μέρες. */
  | {
      readonly kind: 'funded'; readonly amountMinor: MinorAmount; readonly paymentReference: string;
      readonly withdrawalWaiverAt: string | null; readonly at: string;
    }
  /** Ο μηχανικός δηλώνει «έγινε η αυτοψία» — ανοίγει το παράθυρο αντίρρησης. */
  | { readonly kind: 'work-started'; readonly at: string; readonly byUid: string; readonly engagementId: string }
  | { readonly kind: 'start-objected'; readonly reason: string; readonly at: string; readonly objection: StartObjectionBy }
  /** Ο πάροχος βεβαίωσε ότι το κρατημένο ποσό αποδεσμεύτηκε προς τον μηχανικό. */
  | {
      readonly kind: 'released'; readonly amountMinor: MinorAmount; readonly transferReference: string;
      readonly basis: AdvanceReleaseBasis; readonly at: string;
    }
  /** Ο πάροχος βεβαίωσε επιστροφή (refund πριν από την εκκαθάριση ή reversal μετά). */
  | { readonly kind: 'refunded'; readonly amountMinor: MinorAmount; readonly reference: string; readonly at: string };

export type AdvanceEventKind = AdvanceEvent['kind'];

// ---------------------------------------------------------------------------
// Η παράγωγη κατάσταση
// ---------------------------------------------------------------------------

/**
 * Πού βρίσκεται η προκαταβολή **τώρα**:
 * - `none` — η συμφωνία δεν ζητά προκαταβολή (ή δεν υπάρχει συμφωνία)·
 * - `awaiting-payment` — εγκρίθηκε, δεν πληρώθηκε (μπάλα στον ιδιοκτήτη)·
 * - `held` — πληρώθηκε, κρατείται· ο μηχανικός μπορεί να ξεκινήσει·
 * - `release-pending` — δηλώθηκε έναρξη· αποδεσμεύεται στο `objectionUntil` αν δεν υπάρξει αντίρρηση·
 * - `disputed` — αντίρρηση μέσα στο παράθυρο· αποφασίζει το γραφείο·
 * - `released` — στον μηχανικό (ίσως με μεταγενέστερη μερική επιστροφή)·
 * - `refunded` — ολόκληρο το εισπραχθέν επεστράφη.
 */
export type AdvanceState =
  | { readonly kind: 'none' }
  | { readonly kind: 'awaiting-payment'; readonly amountMinor: MinorAmount }
  | { readonly kind: 'held'; readonly fundedMinor: MinorAmount; readonly refundedMinor: MinorAmount }
  | { readonly kind: 'release-pending'; readonly fundedMinor: MinorAmount; readonly objectionUntil: string }
  | { readonly kind: 'disputed'; readonly fundedMinor: MinorAmount; readonly reason: string }
  | { readonly kind: 'released'; readonly fundedMinor: MinorAmount; readonly releasedMinor: MinorAmount; readonly refundedMinor: MinorAmount }
  | { readonly kind: 'refunded'; readonly fundedMinor: MinorAmount; readonly refundedMinor: MinorAmount };

export type AdvanceStateKind = AdvanceState['kind'];

/** Τα γεγονότα που κρίνουν την προκαταβολή — δομικά, ώστε το φύλλο να μην εισάγει τον μειωτή. */
export interface AdvanceFacts extends QuoteAgreementFacts {
  readonly advanceEvents: readonly AdvanceEvent[];
}

function sumOf(events: readonly AdvanceEvent[], kind: 'funded' | 'released' | 'refunded'): MinorAmount {
  return events.reduce((sum, event) => (event.kind === kind ? sum + event.amountMinor : sum), 0);
}

function lastOf<K extends AdvanceEventKind>(events: readonly AdvanceEvent[], kind: K): Extract<AdvanceEvent, { kind: K }> | null {
  const found = [...events].reverse().find((event): event is Extract<AdvanceEvent, { kind: K }> => event.kind === kind);
  return found ?? null;
}

/** Το τέλος του παραθύρου αντίρρησης (Κ-4) — ISO στιγμή. */
export function objectionUntilOf(startedAtIso: string): string {
  return new Date(Date.parse(startedAtIso) + ADVANCE_POLICY.objectionWindowHours * 3_600_000).toISOString();
}

/** Η κατάσταση μετά την πληρωμή — από τα γεγονότα **μόνο** (η συμφωνία μπορεί να αλλάξει, τα χρήματα κινήθηκαν). */
function fundedStateOf(events: readonly AdvanceEvent[], fundedMinor: MinorAmount): AdvanceState {
  const refundedMinor = sumOf(events, 'refunded');
  const releasedMinor = sumOf(events, 'released');
  if (refundedMinor >= fundedMinor) return { kind: 'refunded', fundedMinor, refundedMinor };
  if (releasedMinor > 0) return { kind: 'released', fundedMinor, releasedMinor, refundedMinor };
  const started = lastOf(events, 'work-started');
  if (started === null) return { kind: 'held', fundedMinor, refundedMinor };
  const objected = lastOf(events, 'start-objected');
  if (objected !== null && objected.at >= started.at) return { kind: 'disputed', fundedMinor, reason: objected.reason };
  return { kind: 'release-pending', fundedMinor, objectionUntil: objectionUntilOf(started.at) };
}

/** **Η μία κρίση** «πού είναι η προκαταβολή;» — όλοι οι αναγνώστες (μειωτής, οθόνη, cron, ειδοποιήσεις) ρωτούν εδώ. */
export function advanceStateOf(facts: AdvanceFacts): AdvanceState {
  const fundedMinor = sumOf(facts.advanceEvents, 'funded');
  if (fundedMinor > 0) return fundedStateOf(facts.advanceEvents, fundedMinor);
  const agreed = agreedQuoteOf(facts);
  return agreed?.advance ? { kind: 'awaiting-payment', amountMinor: agreed.advance.amountMinor } : { kind: 'none' };
}

/** Λήγει τώρα το παράθυρο αντίρρησης; — η αυτόματη αποδέσμευση (cron) ρωτά **μόνο** αυτό. */
export function isAdvanceReleaseDue(state: AdvanceState, nowIso: string): boolean {
  return state.kind === 'release-pending' && nowIso >= state.objectionUntil;
}

/** Μπορεί να φέρει αντίρρηση **τώρα**; — μόνο μέσα στο παράθυρο. */
export function canObjectToStart(state: AdvanceState, nowIso: string): boolean {
  return state.kind === 'release-pending' && nowIso < state.objectionUntil;
}

/** Ό,τι εισπράχθηκε και **δεν** επεστράφη — η βάση του ΜΑΡΚ προκαταβολής και του συμψηφισμού στο τελικό (Κ-7). */
export function advanceCollectedMinor(state: AdvanceState): MinorAmount {
  switch (state.kind) {
    case 'held': case 'released': return state.fundedMinor - state.refundedMinor;
    case 'release-pending': case 'disputed': return state.fundedMinor;
    case 'none': case 'awaiting-payment': case 'refunded': return 0;
  }
}

/**
 * **Πόσο επιστρέφεται αν ακυρωθεί τώρα** (Κ-5): πριν από την έναρξη ό,τι εισπράχθηκε· μετά, ό,τι δεν κρατά η πολιτική.
 * Ακέραια λεπτά — η στρογγύλευση ευνοεί τον ιδιοκτήτη (καταναλωτή).
 */
export function refundDueOnCancelOf(state: AdvanceState, policy: CancellationPolicyId): MinorAmount {
  const collected = advanceCollectedMinor(state);
  if (state.kind === 'held') return collected;
  if (state.kind !== 'release-pending' && state.kind !== 'disputed' && state.kind !== 'released') return 0;
  const retained = Math.floor((collected * RETAINED_AFTER_START_PERCENT[policy]) / 100);
  return collected - retained;
}

/** Το υπόλοιπο που απομένει για το τελικό παραστατικό: σύνολο συμφωνίας − ό,τι εισπράχθηκε ως προκαταβολή. */
export function finalRemainderMinor(facts: AdvanceFacts): MinorAmount | null {
  const agreed = agreedQuoteOf(facts);
  if (agreed === null) return null;
  return quoteTotalsOf(agreed).totalMinor - advanceCollectedMinor(advanceStateOf(facts));
}
