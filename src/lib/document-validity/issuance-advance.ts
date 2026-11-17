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

import { addDaysToDateKey } from '@/lib/calendar/date-key';
import { conveyanceToday } from '@/lib/conveyance/conveyance-calendar';
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
 * όλες (Κ-5). Κρατήθηκαν μετά από έρευνα (ADR-943 §5.5) — ζουν **μόνο** εδώ.
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
  /**
   * Φ4 — **ανώτατη προκαταβολή: 50% του συνόλου**. Πρακτική Airbnb «Pay part now, part later» (πρώτη δόση συνήθως 50%,
   * αποδέσμευση στο check-in — το ΙΔΙΟ πρότυπο με την αποδέσμευση στην έναρξη, Κ-4)· το Upwork χρηματοδοτεί 100% αλλά
   * αποδεσμεύει μόνο με την **έγκριση της παράδοσης**, όχι στην έναρξη. Κρατά την παρακράτηση μετά την έναρξη μέσα στο
   * «αμοιβή − εξοικονόμηση» του ΑΚ 700 (ADR-943 §5.8).
   */
  maxPercentOfTotal: 50,
  /** Φ4 — οι ημέρες υπαναχώρησης από τη σύναψη (ν.2251/1994 άρθρο 3ε · Οδηγία 2011/83 άρθρο 9). */
  withdrawalDays: 14,
} as const;

/**
 * Η προκαταβολή μέσα στους όρους της προσφοράς — ποσό σε λεπτά (μέρος του **συνόλου** με ΦΠΑ), πολιτική, και η **αξία
 * της αυτοψίας**: ό,τι κοστίζει η υπηρεσία που έχει ήδη παρασχεθεί όταν δηλωθεί η έναρξη. Είναι η βάση του αναλογικού
 * τιμήματος αν ο ιδιοκτήτης υπαναχωρήσει μέσα στις 14 ημέρες (ν.2251/1994 άρθρο 3ι §3), και ο ιδιοκτήτης τη βλέπει
 * **πριν** εγκρίνει (3ι §4: χωρίς ενημέρωση δεν οφείλεται τίποτα).
 */
export interface AdvanceTerms {
  readonly amountMinor: MinorAmount;
  readonly policy: CancellationPolicyId;
  readonly inspectionValueMinor: MinorAmount;
}

export function isCancellationPolicy(value: string): value is CancellationPolicyId {
  return (CANCELLATION_POLICIES as readonly string[]).includes(value);
}

/** Η μεγαλύτερη προκαταβολή που επιτρέπεται για αυτό το σύνολο — ακέραια λεπτά, η στρογγύλευση ευνοεί τον ιδιοκτήτη. */
export function maxAdvanceMinorOf(totalMinor: MinorAmount): MinorAmount {
  return Math.floor((totalMinor * ADVANCE_POLICY.maxPercentOfTotal) / 100);
}

function isPositiveMinor(value: number): boolean {
  return isMinorAmount(value) && value > 0;
}

/**
 * Αποδεκτή προκαταβολή; — θετικό ακέραιο ποσό **ως** το ανώτατο ({@link maxAdvanceMinorOf}), γνωστή πολιτική, αξία
 * αυτοψίας θετική και όχι πάνω από το σύνολο.
 */
export function isAdvanceTermsValid(advance: AdvanceTerms, totalMinor: MinorAmount): boolean {
  return isPositiveMinor(advance.amountMinor) && advance.amountMinor <= maxAdvanceMinorOf(totalMinor)
    && isCancellationPolicy(advance.policy)
    && isPositiveMinor(advance.inspectionValueMinor) && advance.inspectionValueMinor <= totalMinor;
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

/**
 * Φ5α — **η ματιά** της προκαταβολής για κάθε οθόνη (μηχανικός · σελίδα ιδιοκτήτη · γραφείο): οι συμφωνημένοι όροι, πού
 * βρίσκονται τα χρήματα, και **πότε** αποδεσμεύονται αν δεν υπάρξει αντίρρηση. `null` ⇒ η συμφωνία δεν έχει προκαταβολή
 * και δεν κινήθηκαν χρήματα. Οι όροι από τη **συμφωνία**· η κατάσταση από τα **γεγονότα** (`advanceStateOf`).
 */
export interface AdvanceGlance {
  readonly terms: AdvanceTerms | null;
  readonly state: AdvanceStateKind;
  /** `release-pending` ⇒ η στιγμή της αυτόματης αποδέσμευσης (ISO)· αλλιώς `null`. */
  readonly releaseAt: string | null;
  /** Ό,τι εισπράχθηκε και δεν επεστράφη (`advanceCollectedMinor`). */
  readonly collectedMinor: MinorAmount;
}

export function advanceGlanceOf(facts: AdvanceFacts): AdvanceGlance | null {
  const state = advanceStateOf(facts);
  if (state.kind === 'none') return null;
  return {
    terms: agreedQuoteOf(facts)?.advance ?? null,
    state: state.kind,
    releaseAt: state.kind === 'release-pending' ? state.objectionUntil : null,
    collectedMinor: advanceCollectedMinor(state),
  };
}

/** Ό,τι εισπράχθηκε και **δεν** επεστράφη — η βάση του ΜΑΡΚ προκαταβολής και του συμψηφισμού στο τελικό (Κ-7). */
export function advanceCollectedMinor(state: AdvanceState): MinorAmount {
  switch (state.kind) {
    case 'held': case 'released': return state.fundedMinor - state.refundedMinor;
    case 'release-pending': case 'disputed': return state.fundedMinor;
    case 'none': case 'awaiting-payment': case 'refunded': return 0;
  }
}

/** Τα γεγονότα της ακύρωσης — και **πότε** εγκρίθηκε η προσφορά (η σύναψη της σύμβασης). */
export interface CancellationFacts extends AdvanceFacts {
  readonly decision: (NonNullable<QuoteAgreementFacts['decision']> & { readonly at: string }) | null;
}

/**
 * Μέσα στην προθεσμία υπαναχώρησης; — η ημέρα ακύρωσης ως και την 14η μετά την έγκριση (ελληνικές ημέρες· η προθεσμία
 * αρχίζει την επόμενη της σύναψης, Κανονισμός 1182/71). Χωρίς έγκριση ⇒ όχι (δεν υπάρχει σύμβαση).
 */
export function isWithinWithdrawalPeriod(facts: CancellationFacts, atIso: string): boolean {
  if (facts.decision === null) return false;
  const lastDay = addDaysToDateKey(conveyanceToday(new Date(facts.decision.at)), ADVANCE_POLICY.withdrawalDays);
  return lastDay !== null && conveyanceToday(new Date(atIso)) <= lastDay;
}

/** Η παρακράτηση της πολιτικής πάνω σε ποσό — ακέραια λεπτά, η στρογγύλευση ευνοεί τον ιδιοκτήτη. */
function retainedByPolicyMinor(policy: CancellationPolicyId, collected: MinorAmount): MinorAmount {
  return Math.floor((collected * RETAINED_AFTER_START_PERCENT[policy]) / 100);
}

/**
 * Πόσο **κρατά** ο μηχανικός μετά την έναρξη: η πολιτική (Κ-5)· μέσα στις 14 ημέρες **το πολύ** η αξία της αυτοψίας
 * (ν.2251/1994 άρθρο 3ι §3 — αναλογικό τίμημα), και **τίποτα** χωρίς ρητό αίτημα έναρξης (3ι §4 α ii). Ισχύει για **κάθε**
 * ιδιοκτήτη: όπως οι μεγάλες πλατφόρμες (Airbnb · Etsy κατατάσσουν μόνο τον πάροχο), δεν κατατάσσουμε τον αγοραστή.
 */
function retainedAfterStartMinor(terms: AdvanceTerms, collected: MinorAmount, withdrawal: 'outside' | 'waived' | 'not-waived'): MinorAmount {
  const byPolicy = retainedByPolicyMinor(terms.policy, collected);
  if (withdrawal === 'outside') return byPolicy;
  return withdrawal === 'not-waived' ? 0 : Math.min(byPolicy, terms.inspectionValueMinor);
}

/**
 * **Πόσο επιστρέφεται αν ακυρωθεί τη στιγμή `atIso`** (Κ-5 + υπαναχώρηση): πριν από την έναρξη ό,τι εισπράχθηκε· μετά, ό,τι
 * δεν κρατά ο μηχανικός. Η ΜΙΑ κρίση — τη ρωτούν η ακύρωση (Φ5) και ο πίνακας της έγκρισης ({@link cancellationScheduleOf}).
 */
export function refundDueOnCancelOf(facts: CancellationFacts, atIso: string): MinorAmount {
  const state = advanceStateOf(facts);
  const collected = advanceCollectedMinor(state);
  if (state.kind === 'held') return collected;
  if (state.kind !== 'release-pending' && state.kind !== 'disputed' && state.kind !== 'released') return 0;
  const terms = agreedQuoteOf(facts)?.advance ?? null;
  // Αμυντικά: χρήματα χωρίς συμφωνημένο όρο (η αναθεώρηση μετά την πληρωμή απαγορεύεται) ⇒ ποτέ παρακράτηση.
  if (terms === null) return collected;
  const waived = lastOf(facts.advanceEvents, 'funded')?.withdrawalWaiverAt != null;
  const withdrawal = !isWithinWithdrawalPeriod(facts, atIso) ? 'outside' : waived ? 'waived' : 'not-waived';
  return collected - Math.min(collected, retainedAfterStartMinor(terms, collected, withdrawal));
}

/** Μία γραμμή του πίνακα ακύρωσης που βλέπει ο ιδιοκτήτης **πριν** εγκρίνει — ποσά, όχι κείμενο πολιτικής. */
export interface CancellationScheduleRow {
  readonly when: 'before-start' | 'after-start-within-withdrawal' | 'after-start-later';
  readonly refundMinor: MinorAmount;
  readonly retainedMinor: MinorAmount;
}

/**
 * **Ο πίνακας ακύρωσης** των όρων — πέρα από τους μεγάλους: ο Airbnb δείχνει κείμενο πολιτικής, εδώ δείχνονται **ποσά**,
 * από τους **ίδιους** κανόνες με την πραγματική επιστροφή ({@link retainedAfterStartMinor}). Προϋποθέτει το ρητό αίτημα
 * έναρξης της πληρωμής (Κ-6) — χωρίς αυτό η εφαρμογή δεν ξεκινά πληρωμή.
 */
export function cancellationScheduleOf(terms: AdvanceTerms): readonly CancellationScheduleRow[] {
  const collected = terms.amountMinor;
  const row = (when: CancellationScheduleRow['when'], retainedMinor: MinorAmount): CancellationScheduleRow => (
    { when, refundMinor: collected - retainedMinor, retainedMinor }
  );
  return [
    row('before-start', 0),
    row('after-start-within-withdrawal', retainedAfterStartMinor(terms, collected, 'waived')),
    row('after-start-later', retainedAfterStartMinor(terms, collected, 'outside')),
  ];
}

/** Το υπόλοιπο που απομένει για το τελικό παραστατικό: σύνολο συμφωνίας − ό,τι εισπράχθηκε ως προκαταβολή. */
export function finalRemainderMinor(facts: AdvanceFacts): MinorAmount | null {
  const agreed = agreedQuoteOf(facts);
  if (agreed === null) return null;
  return quoteTotalsOf(agreed).totalMinor - advanceCollectedMinor(advanceStateOf(facts));
}
