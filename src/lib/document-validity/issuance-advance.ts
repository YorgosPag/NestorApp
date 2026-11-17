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

import { agreedQuoteOf, quoteTotalsOf, type IssuanceReceipt, type QuoteAgreementFacts } from './issuance-quote';

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
  /**
   * Φ5β (Ζ-1) — η **σελίδα προκαταβολής** ζει όσο ζουν τα χρήματα: κάθε σύνδεσμος υπογράφεται για το πολύ 120 ημέρες, και
   * σβήνει 30 ημέρες μετά το τέλος τους (αποδέσμευση ή επιστροφή). Πρακτική Stripe hosted invoice (30 ημ. μετά, ≤ 120 ημ.).
   */
  linkLifetimeDays: 120,
  linkAfterSettledDays: 30,
  /**
   * Φ5β — πόσοι σύνδεσμοι προκαταβολής ζουν ταυτόχρονα για μία απόφαση: κάθε email δουλεύει (Stripe), αλλά **φραγμένα**
   * — ο νέος ανακαλεί τους παλαιότερους πέρα από αυτό το όριο (κανένα σφάλμα δεν γεννά απεριόριστους ζωντανούς συνδέσμους).
   */
  liveLinksCap: 3,
  /** Φ5γ (Θ-5) — μέγιστο μήκος αιτιολογίας της απόφασης του γραφείου σε διαφορά. */
  resolutionReasonMax: 1_000,
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

/**
 * Γιατί αποδεσμεύτηκαν: πέρασε το παράθυρο χωρίς αντίρρηση · αποφάσισε το γραφείο μετά από αντίρρηση · Φ5γ: ακύρωση μετά
 * την έναρξη (ό,τι κρατά ο μηχανικός κατά την πολιτική).
 */
export const ADVANCE_RELEASE_BASES = ['window-elapsed', 'office-resolution', 'cancellation'] as const;
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
  /**
   * Φ5γ (Θ-5) — **η απόφαση του γραφείου** στη διαφορά: πόσα πάνε συνολικά στον μηχανικό και πόσα πίσω (σύνολα πάνω στο
   * εισπραχθέν — η εντολή χρημάτων είναι δηλωτική). Οριστική· υπερισχύει της πολιτικής (Ζ-5).
   */
  | {
      readonly kind: 'dispute-resolved'; readonly releaseMinor: MinorAmount; readonly refundMinor: MinorAmount;
      readonly reason: string; readonly at: string; readonly byUid: string;
    }
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
 * - `disputed` — αντίρρηση μέσα στο παράθυρο· αποφασίζει το γραφείο (`resolution` ⇒ αποφάσισε, τα χρήματα κινούνται)·
 * - `released` — στον μηχανικό (ίσως με μεταγενέστερη μερική επιστροφή)·
 * - `refunded` — ολόκληρο το εισπραχθέν επεστράφη.
 */
export type AdvanceState =
  | { readonly kind: 'none' }
  | { readonly kind: 'awaiting-payment'; readonly amountMinor: MinorAmount }
  | { readonly kind: 'held'; readonly fundedMinor: MinorAmount; readonly refundedMinor: MinorAmount }
  | { readonly kind: 'release-pending'; readonly fundedMinor: MinorAmount; readonly refundedMinor: MinorAmount; readonly objectionUntil: string }
  | {
      readonly kind: 'disputed'; readonly fundedMinor: MinorAmount; readonly refundedMinor: MinorAmount; readonly reason: string;
      readonly resolution: AdvanceDisputeResolution | null;
    }
  | { readonly kind: 'released'; readonly fundedMinor: MinorAmount; readonly releasedMinor: MinorAmount; readonly refundedMinor: MinorAmount }
  | { readonly kind: 'refunded'; readonly fundedMinor: MinorAmount; readonly refundedMinor: MinorAmount };

export type AdvanceStateKind = AdvanceState['kind'];

/** Φ5γ — η απόφαση του γραφείου, όπως τη χρειάζονται κατάσταση και εντολή χρημάτων (χωρίς αιτιολογία). */
export interface AdvanceDisputeResolution {
  readonly releaseMinor: MinorAmount;
  readonly refundMinor: MinorAmount;
  readonly at: string;
}

/** Τα γεγονότα που κρίνουν την προκαταβολή — δομικά, ώστε το φύλλο να μην εισάγει τον μειωτή. */
export interface AdvanceFacts extends QuoteAgreementFacts {
  readonly advanceEvents: readonly AdvanceEvent[];
}

/** Φ5δ — + το παραστατικό της προκαταβολής (ΜΑΡΚ, Κ-7): ό,τι χρειάζονται η ματιά και το χρονολόγιο κάθε οθόνης. */
export interface AdvanceReceiptFacts extends AdvanceFacts {
  readonly advanceReceipt: IssuanceReceipt | null;
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

/** Η ζωντανή αντίρρηση: η τελευταία, αν ήρθε μετά την (τελευταία) δήλωση έναρξης. */
function liveObjectionOf(events: readonly AdvanceEvent[]): Extract<AdvanceEvent, { kind: 'start-objected' }> | null {
  const started = lastOf(events, 'work-started');
  const objected = lastOf(events, 'start-objected');
  return started !== null && objected !== null && objected.at >= started.at ? objected : null;
}

/**
 * Φ5γ — **η απόφαση του γραφείου** για τη ζωντανή αντίρρηση, αν υπάρχει. Ζει στα γεγονότα και μετά την κίνηση των χρημάτων
 * (η κατάσταση γίνεται `released`/`refunded`), ώστε η εντολή να ξέρει ότι **αυτή** κρίνει — ποτέ η πολιτική ακύρωσης.
 */
export function advanceResolutionOf(facts: AdvanceFacts): AdvanceDisputeResolution | null {
  const objected = liveObjectionOf(facts.advanceEvents);
  const resolved = lastOf(facts.advanceEvents, 'dispute-resolved');
  if (objected === null || resolved === null || resolved.at < objected.at) return null;
  return { releaseMinor: resolved.releaseMinor, refundMinor: resolved.refundMinor, at: resolved.at };
}

/** Η κατάσταση μετά την πληρωμή — από τα γεγονότα **μόνο** (η συμφωνία μπορεί να αλλάξει, τα χρήματα κινήθηκαν). */
function fundedStateOf(facts: AdvanceFacts, fundedMinor: MinorAmount): AdvanceState {
  const events = facts.advanceEvents;
  const refundedMinor = sumOf(events, 'refunded');
  const releasedMinor = sumOf(events, 'released');
  if (refundedMinor >= fundedMinor) return { kind: 'refunded', fundedMinor, refundedMinor };
  if (releasedMinor > 0) return { kind: 'released', fundedMinor, releasedMinor, refundedMinor };
  const started = lastOf(events, 'work-started');
  if (started === null) return { kind: 'held', fundedMinor, refundedMinor };
  const objected = liveObjectionOf(events);
  if (objected !== null) {
    return { kind: 'disputed', fundedMinor, refundedMinor, reason: objected.reason, resolution: advanceResolutionOf(facts) };
  }
  return { kind: 'release-pending', fundedMinor, refundedMinor, objectionUntil: objectionUntilOf(started.at) };
}

/** **Η μία κρίση** «πού είναι η προκαταβολή;» — όλοι οι αναγνώστες (μειωτής, οθόνη, cron, ειδοποιήσεις) ρωτούν εδώ. */
export function advanceStateOf(facts: AdvanceFacts): AdvanceState {
  const fundedMinor = sumOf(facts.advanceEvents, 'funded');
  if (fundedMinor > 0) return fundedStateOf(facts, fundedMinor);
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
  /** Φ5δ — το παραστατικό της προκαταβολής, αν καταγράφηκε. */
  readonly receipt: { readonly mark: string; readonly issuedOn: string } | null;
  /** Φ5δ — εισπράχθηκαν χρήματα χωρίς ΜΑΡΚ: το παραστατικό οφείλεται (ποσό = `collectedMinor`). */
  readonly receiptDue: boolean;
  /**
   * Φ5δ — ο ΜΑΡΚ γράφει **περισσότερα** από όσα κρατήθηκαν τελικά (επιστροφή μετά την έκδοση): χρειάζεται πιστωτικό
   * παραστατικό — λογιστική πράξη εκτός εφαρμογής (ADR-943 §8 #5)· η οθόνη απλώς το λέει.
   */
  readonly refundedAfterReceipt: boolean;
}

export function advanceGlanceOf(facts: AdvanceReceiptFacts): AdvanceGlance | null {
  const state = advanceStateOf(facts);
  if (state.kind === 'none') return null;
  const collectedMinor = advanceCollectedMinor(state);
  const receipt = facts.advanceReceipt;
  return {
    terms: agreedQuoteOf(facts)?.advance ?? null,
    state: state.kind,
    releaseAt: state.kind === 'release-pending' ? state.objectionUntil : null,
    collectedMinor,
    receipt: receipt === null ? null : { mark: receipt.mark, issuedOn: receipt.issuedOn },
    receiptDue: receipt === null && collectedMinor > 0,
    refundedAfterReceipt: receipt !== null && receipt.totalMinor > collectedMinor,
  };
}

/** Ό,τι εισπράχθηκε και **δεν** επεστράφη — η βάση του ΜΑΡΚ προκαταβολής και του συμψηφισμού στο τελικό (Κ-7). */
export function advanceCollectedMinor(state: AdvanceState): MinorAmount {
  switch (state.kind) {
    // Φ5γ: και η εκκρεμής αποδέσμευση / η διαφορά αφαιρούν ό,τι ήδη επεστράφη (μερική επιστροφή ακύρωσης ή απόφασης).
    case 'held': case 'released': case 'release-pending': case 'disputed': return state.fundedMinor - state.refundedMinor;
    case 'none': case 'awaiting-payment': case 'refunded': return 0;
  }
}

/**
 * Φ5β — **πότε τελείωσαν τα χρήματα**: η στιγμή του τελευταίου γεγονότος αποδέσμευσης/επιστροφής, μόνο όταν η κατάσταση
 * είναι τελική (`released` · `refunded`). `null` ⇒ τα χρήματα ζουν ακόμη (ή δεν κινήθηκαν).
 */
export function advanceSettledAtOf(facts: AdvanceFacts): string | null {
  const kind = advanceStateOf(facts).kind;
  if (kind !== 'released' && kind !== 'refunded') return null;
  const last = [...facts.advanceEvents].reverse().find((event) => event.kind === 'released' || event.kind === 'refunded');
  return last?.at ?? null;
}

/** Ζ-1 — ζει ακόμη η σελίδα προκαταβολής; — ως 30 ημέρες μετά το τέλος των χρημάτων (η λήξη της υπογραφής κρίνεται αλλού). */
export function isAdvancePageLive(facts: AdvanceFacts, nowIso: string): boolean {
  const settledAt = advanceSettledAtOf(facts);
  if (settledAt === null) return true;
  return Date.parse(nowIso) < Date.parse(settledAt) + ADVANCE_POLICY.linkAfterSettledDays * 86_400_000;
}

/** Μία γραμμή του χρονολογίου χρημάτων — **τι** έγινε, **πότε**, και (όπου κινήθηκαν) **πόσα**. */
export type AdvanceTimelineEntry =
  | { readonly kind: 'funded' | 'released' | 'refunded'; readonly at: string; readonly amountMinor: MinorAmount }
  | { readonly kind: 'work-started'; readonly at: string }
  | { readonly kind: 'start-objected'; readonly at: string; readonly by: StartObjectionBy['by'] }
  | { readonly kind: 'dispute-resolved'; readonly at: string; readonly releaseMinor: MinorAmount; readonly refundMinor: MinorAmount }
  /** Φ5δ — καταγράφηκε το παραστατικό της προκαταβολής (ΜΑΡΚ · ημέρα έκδοσης · ποσό). */
  | { readonly kind: 'receipted'; readonly at: string; readonly mark: string; readonly issuedOn: string; readonly amountMinor: MinorAmount };

function timelineEntryOf(event: AdvanceEvent): AdvanceTimelineEntry {
  switch (event.kind) {
    case 'funded': case 'released': case 'refunded': return { kind: event.kind, at: event.at, amountMinor: event.amountMinor };
    case 'work-started': return { kind: 'work-started', at: event.at };
    case 'start-objected': return { kind: 'start-objected', at: event.at, by: event.objection.by };
    case 'dispute-resolved': return { kind: 'dispute-resolved', at: event.at, releaseMinor: event.releaseMinor, refundMinor: event.refundMinor };
  }
}

/**
 * Φ5β — **το χρονολόγιο των χρημάτων** (πληρώθηκε → αυτοψία → αντίρρηση → αποδέσμευση/επιστροφή) για κάθε οθόνη. Από τα
 * γεγονότα, με τη σειρά τους· **χωρίς** αιτιολογίες ή ταυτότητες ανθρώπων (Ε-9′: η ίδια λίστα δείχνεται παντού).
 * Φ5δ: + το παραστατικό στη θέση του χρόνου του (ίδια στιγμή ⇒ μετά το γεγονός).
 */
export function advanceTimelineOf(facts: AdvanceReceiptFacts): readonly AdvanceTimelineEntry[] {
  const entries = facts.advanceEvents.map(timelineEntryOf);
  const receipt = facts.advanceReceipt;
  if (receipt === null) return entries;
  const receipted: AdvanceTimelineEntry = { kind: 'receipted', at: receipt.at, mark: receipt.mark, issuedOn: receipt.issuedOn, amountMinor: receipt.totalMinor };
  const index = entries.findIndex((entry) => entry.at > receipt.at);
  return index === -1 ? [...entries, receipted] : [...entries.slice(0, index), receipted, ...entries.slice(index)];
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
  return Math.max(0, cancellationRefundTotalOf(facts, atIso) - sumOf(facts.advanceEvents, 'refunded'));
}

/**
 * Φ5γ — **πόσα επιστρέφονται ΣΥΝΟΛΙΚΑ** αν ακυρωθεί τη στιγμή `atIso`: πάνω σε ό,τι **εισπράχθηκε** (`funded`), ποτέ στο
 * καθαρό — η εντολή χρημάτων είναι δηλωτική («συνολικά επιστραμμένα Χ») και πρέπει να μένει ίδια πριν και μετά από μια
 * μερική επιστροφή. Πριν από την έναρξη: όλο (Κ-5).
 */
export function cancellationRefundTotalOf(facts: CancellationFacts, atIso: string): MinorAmount {
  const fundedMinor = sumOf(facts.advanceEvents, 'funded');
  if (fundedMinor === 0 || lastOf(facts.advanceEvents, 'work-started') === null) return fundedMinor;
  const terms = agreedQuoteOf(facts)?.advance ?? null;
  // Αμυντικά: χρήματα χωρίς συμφωνημένο όρο (η αναθεώρηση μετά την πληρωμή απαγορεύεται) ⇒ ποτέ παρακράτηση.
  if (terms === null) return fundedMinor;
  const waived = lastOf(facts.advanceEvents, 'funded')?.withdrawalWaiverAt != null;
  const withdrawal = !isWithinWithdrawalPeriod(facts, atIso) ? 'outside' : waived ? 'waived' : 'not-waived';
  return fundedMinor - Math.min(fundedMinor, retainedAfterStartMinor(terms, fundedMinor, withdrawal));
}

/** Ό,τι εισπράχθηκε ποτέ (πριν από επιστροφές) — η βάση κάθε εντολής χρημάτων. */
export function advanceFundedMinor(facts: AdvanceFacts): MinorAmount {
  return sumOf(facts.advanceEvents, 'funded');
}

/** Ό,τι έχει ήδη επιστραφεί / αποδεσμευτεί (βεβαιωμένο από τον πάροχο). */
export function advanceMovedMinor(facts: AdvanceFacts): { readonly refundedMinor: MinorAmount; readonly releasedMinor: MinorAmount } {
  return { refundedMinor: sumOf(facts.advanceEvents, 'refunded'), releasedMinor: sumOf(facts.advanceEvents, 'released') };
}

/** Φ5δ — τα ποσά με μια ματιά (πίνακας γραφείου, πρότυπο Stripe «payment»): εισπράχθηκαν · επεστράφησαν · αποδόθηκαν · κρατούνται. */
export interface AdvanceLedger {
  readonly fundedMinor: MinorAmount;
  readonly refundedMinor: MinorAmount;
  readonly releasedMinor: MinorAmount;
  /** Ό,τι κρατά ακόμη ο πάροχος — ούτε επεστράφη ούτε αποδόθηκε. */
  readonly heldMinor: MinorAmount;
}

export function advanceLedgerOf(facts: AdvanceFacts): AdvanceLedger {
  const fundedMinor = advanceFundedMinor(facts);
  const { refundedMinor, releasedMinor } = advanceMovedMinor(facts);
  return { fundedMinor, refundedMinor, releasedMinor, heldMinor: Math.max(0, fundedMinor - refundedMinor - releasedMinor) };
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
