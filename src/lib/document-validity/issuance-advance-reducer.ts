/**
 * =============================================================================
 * Μητρώο λήξεων — Ο ΜΕΙΩΤΗΣ της προκαταβολής (ADR-943)
 * =============================================================================
 *
 * **«Ποιος γράφει ποιο γεγονός χρημάτων, από ποια κατάσταση;»** Ο `reduceIssuance` αναθέτει εδώ κάθε πράξη προκαταβολής·
 * η κρίση είναι η ίδια στον διακομιστή (συναλλαγή) και στην αισιόδοξη οθόνη.
 *
 * 🔑 **Γεγονότα χρημάτων μόνο από `system`** (`advance-funded` · `advance-released` · `advance-refunded`): τα γράφει ο
 *    διακομιστής **αφού** διάβασε την αλήθεια στο API του παρόχου (ADR-943 Κ-8). Κανένας άνθρωπος δεν «δηλώνει πληρωμή».
 * 🔑 **Ιδεμποτία από ταυτότητα**: ίδια αναφορά παρόχου ⇒ `changed: false` (webhook + cron + επιστροφή browser για την ίδια
 *    κίνηση γράφουν **μία** φορά).
 * 🔑 Η πράξη κρίνεται πάνω στην **εγγραφή**, όχι στο «ανοιχτή ανάθεση;»: χρήματα κινούνται και μετά από ακύρωση (επιστροφή)
 *    ή αφού εκδοθεί το έγγραφο (αποδέσμευση που έληξε).
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, μηδέν I/O· από τον μειωτή **μόνο τύποι**.
 *
 * @module lib/document-validity/issuance-advance-reducer
 */

import { isMinorAmount, type MinorAmount } from '@/lib/money/money';

import {
  ADVANCE_POLICY, advanceCollectedMinor, advanceFundedMinor, advanceStateOf, canObjectToStart, isAdvanceReleaseDue,
  type AdvanceEvent, type AdvanceReleaseBasis, type AdvanceState, type StartObjectionBy,
} from './issuance-advance';
import { advanceSettlementDueOf } from './issuance-advance-settlement';
import type { IssuanceActor } from './issuance-actor';
import type { IssuanceAssignmentRecord, IssuanceReduction } from './issuance-assignment';
import { MYDATA_MARK_PATTERN, type IssuanceReceipt } from './issuance-quote';
import { issuanceStageOf, type IssuanceStage } from './issuance-stage';

export type IssuanceAdvanceAction =
  /** `system` — ο πάροχος βεβαίωσε την πληρωμή της εγκεκριμένης προκαταβολής. */
  | {
      readonly kind: 'advance-funded'; readonly amountMinor: number; readonly paymentReference: string;
      readonly withdrawalWaiverAt: string | null;
    }
  /** `engagement` — ο μηχανικός δηλώνει «έγινε η αυτοψία». */
  | { readonly kind: 'start-work' }
  /**
   * αντίρρηση μέσα στο παράθυρο: το γραφείο (καταγραφή για λογαριασμό του ιδιοκτήτη) ή ο ίδιος ο ιδιοκτήτης με σύνδεσμο
   * (Φ5β, Ζ-3). Ότι ο σύνδεσμος ανήκει στον ιδιοκτήτη της απόφασης το αποδεικνύει ο διακομιστής πριν από τον μειωτή
   * (`issuance-advance-checkout.ts`), όπως τη συμμετοχή του `engagement`.
   */
  | { readonly kind: 'object-start'; readonly reason: string }
  /**
   * Φ5γ (Θ-5) — `office`: η απόφαση στη διαφορά — πόσα **συνολικά** στον μηχανικό (0 = όλα πίσω · όλο = όλα στον μηχανικό ·
   * ενδιάμεσο = διαίρεση), με αιτιολογία. Οριστική.
   */
  | { readonly kind: 'resolve-advance-dispute'; readonly releaseMinor: number; readonly reason: string }
  /** `system` — ο πάροχος βεβαίωσε την αποδέσμευση προς τον μηχανικό. */
  | {
      readonly kind: 'advance-released'; readonly amountMinor: number; readonly transferReference: string;
      readonly basis: AdvanceReleaseBasis;
    }
  /** `system` — ο πάροχος βεβαίωσε επιστροφή (refund ή reversal). */
  | { readonly kind: 'advance-refunded'; readonly amountMinor: number; readonly reference: string }
  /** μηχανικός ή γραφείο — ο ΜΑΡΚ του παραστατικού προκαταβολής, ίσος με ό,τι εισπράχθηκε (Κ-7). */
  | { readonly kind: 'record-advance-receipt'; readonly mark: string; readonly issuedOn: string; readonly totalMinor: number };

export type IssuanceAdvanceActionKind = IssuanceAdvanceAction['kind'];

/** Ποιος actor κάνει ποια πράξη — «ποιος» πριν από «από πού», σε **κανένα** στάδιο τις ξένες. */
const ACTORS_OF: Readonly<Record<IssuanceAdvanceActionKind, readonly IssuanceActor['kind'][]>> = {
  'advance-funded': ['system'],
  'start-work': ['engagement'],
  'object-start': ['office', 'link'],
  'resolve-advance-dispute': ['office'],
  'advance-released': ['system'],
  'advance-refunded': ['system'],
  'record-advance-receipt': ['engagement', 'office'],
};

/** Από ποια στάδια — επιστροφή/αποδέσμευση/ΜΑΡΚ και μετά από ακύρωση (το παρακρατούμενο της πολιτικής). */
const STAGES_OF: Readonly<Record<IssuanceAdvanceActionKind, readonly IssuanceStage[]>> = {
  'advance-funded': ['accepted'],
  'start-work': ['accepted'],
  'object-start': ['accepted'],
  // Φ5γ — η διαφορά επιβιώνει της ακύρωσης: τα χρήματα παγώνουν ως την απόφαση (Θ-4).
  'resolve-advance-dispute': ['accepted', 'cancelled'],
  'advance-released': ['accepted', 'cancelled'],
  'advance-refunded': ['accepted', 'cancelled'],
  'record-advance-receipt': ['accepted', 'cancelled'],
};

const ADVANCE_ACTION_KINDS: ReadonlySet<string> = new Set(Object.keys(ACTORS_OF));

export function isIssuanceAdvanceAction(action: { readonly kind: string }): action is IssuanceAdvanceAction {
  return ADVANCE_ACTION_KINDS.has(action.kind);
}

type Reduction = IssuanceReduction;
const REFUSED = (refusal: Extract<Reduction, { ok: false }>['refusal']): Reduction => ({ ok: false, refusal });
const UNCHANGED = (record: IssuanceAssignmentRecord): Reduction => ({ ok: true, record, changed: false });

function appended(record: IssuanceAssignmentRecord, event: AdvanceEvent): Reduction {
  if (record.advanceEvents.length >= ADVANCE_POLICY.maxEvents) return REFUSED('transition-refused');
  return { ok: true, record: { ...record, advanceEvents: [...record.advanceEvents, event] }, changed: true };
}

function hasReference(record: IssuanceAssignmentRecord, reference: string): boolean {
  return record.advanceEvents.some((event) =>
    (event.kind === 'funded' && event.paymentReference === reference)
    || (event.kind === 'released' && event.transferReference === reference)
    || (event.kind === 'refunded' && event.reference === reference));
}

function isPositiveAmount(amount: number): amount is MinorAmount {
  return isMinorAmount(amount) && amount > 0;
}

function funded(record: IssuanceAssignmentRecord, state: AdvanceState, action: Extract<IssuanceAdvanceAction, { kind: 'advance-funded' }>, at: string): Reduction {
  if (hasReference(record, action.paymentReference)) return UNCHANGED(record);
  if (state.kind !== 'awaiting-payment') return REFUSED('transition-refused');
  if (action.amountMinor !== state.amountMinor) return REFUSED('terms-refused');
  return appended(record, {
    kind: 'funded', amountMinor: state.amountMinor, paymentReference: action.paymentReference,
    withdrawalWaiverAt: action.withdrawalWaiverAt, at,
  });
}

/**
 * Επιτρέπεται αποδέσμευση με αυτόν τον λόγο; — η αυτόματη μόνο όταν λήξει το παράθυρο· ακύρωση και απόφαση μόνο όταν ο
 * τομέας (Θ-1) λέει **αυτόν** τον λόγο και το ποσό χωρά σε ό,τι οφείλεται στον μηχανικό.
 */
function releaseAllowed(record: IssuanceAssignmentRecord, state: AdvanceState, basis: AdvanceReleaseBasis, amountMinor: number, at: string): boolean {
  const due = advanceSettlementDueOf(record);
  if (due === null || due.basis !== basis || amountMinor > due.releaseMinor) return false;
  return basis !== 'window-elapsed' || isAdvanceReleaseDue(state, at);
}

function released(record: IssuanceAssignmentRecord, state: AdvanceState, action: Extract<IssuanceAdvanceAction, { kind: 'advance-released' }>, at: string): Reduction {
  if (hasReference(record, action.transferReference)) return UNCHANGED(record);
  if (!releaseAllowed(record, state, action.basis, action.amountMinor, at)) return REFUSED('transition-refused');
  if (!isPositiveAmount(action.amountMinor) || action.amountMinor > advanceCollectedMinor(state)) return REFUSED('terms-refused');
  return appended(record, { kind: 'released', amountMinor: action.amountMinor, transferReference: action.transferReference, basis: action.basis, at });
}

function refunded(record: IssuanceAssignmentRecord, state: AdvanceState, action: Extract<IssuanceAdvanceAction, { kind: 'advance-refunded' }>, at: string): Reduction {
  if (hasReference(record, action.reference)) return UNCHANGED(record);
  if (!isPositiveAmount(action.amountMinor) || action.amountMinor > advanceCollectedMinor(state)) return REFUSED('terms-refused');
  return appended(record, { kind: 'refunded', amountMinor: action.amountMinor, reference: action.reference, at });
}

function receipted(record: IssuanceAssignmentRecord, state: AdvanceState, action: Extract<IssuanceAdvanceAction, { kind: 'record-advance-receipt' }>, uid: string, at: string): Reduction {
  if (record.advanceReceipt !== null) return record.advanceReceipt.mark === action.mark ? UNCHANGED(record) : REFUSED('transition-refused');
  const collected = advanceCollectedMinor(state);
  if (!MYDATA_MARK_PATTERN.test(action.mark) || collected === 0 || action.totalMinor !== collected) return REFUSED('receipt-mismatch');
  const advanceReceipt: IssuanceReceipt = { mark: action.mark, issuedOn: action.issuedOn, totalMinor: collected, at, recordedByUid: uid };
  return { ok: true, record: { ...record, advanceReceipt }, changed: true };
}

function started(record: IssuanceAssignmentRecord, state: AdvanceState, actor: Extract<IssuanceActor, { kind: 'engagement' }>): Reduction {
  if (state.kind === 'release-pending' || state.kind === 'disputed') return UNCHANGED(record);
  if (state.kind !== 'held') return REFUSED('transition-refused');
  return appended(record, { kind: 'work-started', at: actor.nowIso, byUid: actor.uid, engagementId: actor.engagementId });
}

/** Ποιος έφερε την αντίρρηση — από τον actor, ποτέ από το αίτημα. */
function objectionByOf(actor: Extract<IssuanceActor, { kind: 'office' | 'link' }>): StartObjectionBy {
  return actor.kind === 'office' ? { by: 'office', uid: actor.uid } : { by: 'owner-link', invitationId: actor.invitationId };
}

function objected(record: IssuanceAssignmentRecord, state: AdvanceState, action: Extract<IssuanceAdvanceAction, { kind: 'object-start' }>, actor: Extract<IssuanceActor, { kind: 'office' | 'link' }>): Reduction {
  if (!canObjectToStart(state, actor.nowIso)) return REFUSED('transition-refused');
  const reason = action.reason.trim();
  if (reason.length === 0 || reason.length > ADVANCE_POLICY.objectionReasonMax) return REFUSED('terms-refused');
  return appended(record, { kind: 'start-objected', reason, at: actor.nowIso, objection: objectionByOf(actor) });
}

/** Θ-5 — η απόφαση του γραφείου: μόνο σε διαφορά, ποσό μέσα σε ό,τι κρατείται, αιτιολογία· οριστική (ίδια ⇒ `unchanged`). */
function resolved(record: IssuanceAssignmentRecord, state: AdvanceState, action: Extract<IssuanceAdvanceAction, { kind: 'resolve-advance-dispute' }>, uid: string, at: string): Reduction {
  if (state.kind !== 'disputed') return REFUSED('transition-refused');
  if (state.resolution !== null) return state.resolution.releaseMinor === action.releaseMinor ? UNCHANGED(record) : REFUSED('transition-refused');
  const reason = action.reason.trim();
  if (reason.length === 0 || reason.length > ADVANCE_POLICY.resolutionReasonMax) return REFUSED('terms-refused');
  if (!isMinorAmount(action.releaseMinor) || action.releaseMinor > advanceCollectedMinor(state)) return REFUSED('terms-refused');
  const refundMinor = advanceFundedMinor(record) - action.releaseMinor;
  return appended(record, { kind: 'dispute-resolved', releaseMinor: action.releaseMinor, refundMinor, reason, at, byUid: uid });
}

function uidOf(actor: IssuanceActor): string | null {
  return actor.kind === 'office' || actor.kind === 'engagement' ? actor.uid : null;
}

/** **Η μία κρίση** κάθε πράξης προκαταβολής. `record` = η τρέχουσα εγγραφή (ανοιχτή ή όχι). */
export function reduceIssuanceAdvance(record: IssuanceAssignmentRecord | null, action: IssuanceAdvanceAction, actor: IssuanceActor): Reduction {
  if (!ACTORS_OF[action.kind].includes(actor.kind)) return REFUSED('actor-refused');
  if (record === null || !STAGES_OF[action.kind].includes(issuanceStageOf(record))) return REFUSED('transition-refused');
  const state = advanceStateOf(record);
  switch (action.kind) {
    case 'advance-funded': return funded(record, state, action, actor.nowIso);
    case 'advance-released': return released(record, state, action, actor.nowIso);
    case 'advance-refunded': return refunded(record, state, action, actor.nowIso);
    case 'start-work': return actor.kind === 'engagement' ? started(record, state, actor) : REFUSED('actor-refused');
    case 'object-start': return actor.kind === 'office' || actor.kind === 'link' ? objected(record, state, action, actor) : REFUSED('actor-refused');
    case 'resolve-advance-dispute': return actor.kind === 'office' ? resolved(record, state, action, actor.uid, actor.nowIso) : REFUSED('actor-refused');
    case 'record-advance-receipt': {
      const uid = uidOf(actor);
      return uid === null ? REFUSED('actor-refused') : receipted(record, state, action, uid, actor.nowIso);
    }
  }
}
