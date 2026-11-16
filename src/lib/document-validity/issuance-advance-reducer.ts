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
  ADVANCE_POLICY, advanceCollectedMinor, advanceStateOf, canObjectToStart, isAdvanceReleaseDue,
  type AdvanceEvent, type AdvanceReleaseBasis, type AdvanceState,
} from './issuance-advance';
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
  /** γραφείο — αντίρρηση του ιδιοκτήτη μέσα στο παράθυρο (καταγραφή). */
  | { readonly kind: 'object-start'; readonly reason: string }
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
  'object-start': ['office'],
  'advance-released': ['system'],
  'advance-refunded': ['system'],
  'record-advance-receipt': ['engagement', 'office'],
};

/** Από ποια στάδια — επιστροφή/αποδέσμευση/ΜΑΡΚ και μετά από ακύρωση (το παρακρατούμενο της πολιτικής). */
const STAGES_OF: Readonly<Record<IssuanceAdvanceActionKind, readonly IssuanceStage[]>> = {
  'advance-funded': ['accepted'],
  'start-work': ['accepted'],
  'object-start': ['accepted'],
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

function released(record: IssuanceAssignmentRecord, state: AdvanceState, action: Extract<IssuanceAdvanceAction, { kind: 'advance-released' }>, at: string): Reduction {
  if (hasReference(record, action.transferReference)) return UNCHANGED(record);
  const allowed = action.basis === 'window-elapsed' ? isAdvanceReleaseDue(state, at) : state.kind === 'disputed' || state.kind === 'release-pending';
  if (!allowed) return REFUSED('transition-refused');
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

function objected(record: IssuanceAssignmentRecord, state: AdvanceState, action: Extract<IssuanceAdvanceAction, { kind: 'object-start' }>, actor: Extract<IssuanceActor, { kind: 'office' }>): Reduction {
  if (!canObjectToStart(state, actor.nowIso)) return REFUSED('transition-refused');
  const reason = action.reason.trim();
  if (reason.length === 0 || reason.length > ADVANCE_POLICY.objectionReasonMax) return REFUSED('terms-refused');
  return appended(record, { kind: 'start-objected', reason, at: actor.nowIso, objection: { by: 'office', uid: actor.uid } });
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
    case 'object-start': return actor.kind === 'office' ? objected(record, state, action, actor) : REFUSED('actor-refused');
    case 'record-advance-receipt': {
      const uid = uidOf(actor);
      return uid === null ? REFUSED('actor-refused') : receipted(record, state, action, uid, actor.nowIso);
    }
  }
}
