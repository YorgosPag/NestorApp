/**
 * =============================================================================
 * Μητρώο λήξεων — ΑΙΤΗΜΑ ΑΛΛΑΓΗΣ ΠΡΟΘΕΣΜΙΑΣ από τον μηχανικό (ADR-915 §45.20 Φ6γ)
 * =============================================================================
 *
 * **«Χρειάζομαι περισσότερο χρόνο»** — ο μηχανικός **ζητά**, ποτέ δεν αλλάζει (Procore/ACC «Request date change»): η
 * προθεσμία είναι δέσμευση **του γραφείου** προς τον ιδιοκτήτη. Το γραφείο απαντά:
 * - **αποδοχή** = η υπάρχουσα πράξη `schedule-delivery` (με αιτιολογία)· όσο εκκρεμεί αίτημα, την ίδια μείωση το σημειώνει
 *   `accepted` με την ημέρα που **όρισε** το γραφείο (μπορεί να διαφέρει από τη ζητούμενη)·
 * - **απόρριψη** = `decline-delivery-change`, με αιτιολογία (ο μηχανικός μαθαίνει **γιατί**).
 *
 * 🔑 Το «εκκρεμεί» **ΠΑΡΑΓΕΤΑΙ** (το τελευταίο αίτημα χωρίς απάντηση), δεν αποθηκεύεται δίπλα στα γεγονότα.
 * 🔑 **Ένα εκκρεμές τη φορά** (απόφαση Giorgio 2026-11-16): δεύτερο αίτημα μόνο αφού απαντήσει το γραφείο. Το **ίδιο**
 *    αίτημα ξανά (επανάληψη δικτύου) ⇒ `changed: false`, ποτέ διπλό.
 * 🔑 Ο έλεγχος σταδίου (`accepted`) και actor (μόνο `engagement` ζητά · μόνο γραφείο απαντά) γίνεται στον μειωτή.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, μηδέν I/O· από τον μειωτή **μόνο τύποι**.
 *
 * @module lib/document-validity/issuance-delivery-change
 */

import { isDateKey } from '@/lib/calendar/date-key';
import { conveyanceToday } from '@/lib/conveyance/conveyance-calendar';

import type { IssuanceAssignmentRecord, IssuanceReduction } from './issuance-assignment';
import { issuanceDeliveryOf } from './issuance-delivery-due';

/** Τα όρια — ΕΝΑ σημείο. */
export const DELIVERY_CHANGE_POLICY = {
  /** Μέγιστο μήκος αιτιολογίας (αιτήματος ή απάντησης) — αμυντικά, όπως το `ISSUANCE_NOTE_MAX`. */
  reasonMax: 500,
  /** Αμυντικό φρένο του ιστορικού αιτημάτων — όχι πολιτική. */
  maxEntries: 20,
} as const;

export const DELIVERY_CHANGE_OUTCOMES = ['accepted', 'declined'] as const;
export type DeliveryChangeOutcome = (typeof DELIVERY_CHANGE_OUTCOMES)[number];

/** Η απάντηση του γραφείου — `dueOn` = η ημέρα που όρισε (αποδοχή) · `null` στην απόρριψη. */
export interface DeliveryChangeAnswer {
  readonly outcome: DeliveryChangeOutcome;
  readonly dueOn: string | null;
  readonly reason: string | null;
  readonly at: string;
  readonly byUid: string;
}

/** Ένα αίτημα του μηχανικού — από **ποια** συμμετοχή, με ποια ημέρα και γιατί. */
export interface DeliveryChangeRequest {
  /** ISO ημέρα `YYYY-MM-DD` — η ζητούμενη. */
  readonly dueOn: string;
  readonly reason: string;
  readonly at: string;
  readonly byUid: string;
  readonly engagementId: string;
  /** `null` = εκκρεμεί. */
  readonly answer: DeliveryChangeAnswer | null;
}

/** Η πράξη του μηχανικού (actor `engagement`, μόνο από `accepted`). */
export interface IssuanceRequestDeliveryChangeAction {
  readonly kind: 'request-delivery-change';
  readonly dueOn: string;
  readonly reason: string;
}

/** Η απόρριψη του γραφείου (μόνο με εκκρεμές αίτημα). */
export interface IssuanceDeclineDeliveryChangeAction {
  readonly kind: 'decline-delivery-change';
  readonly reason: string;
}

type ChangeRecord = Pick<IssuanceAssignmentRecord, 'deliveryChangeRequests'>;

/** Το εκκρεμές αίτημα — το τελευταίο, αν δεν έχει απάντηση· `null` = κανένα. */
export function pendingDeliveryChangeOf(record: ChangeRecord): DeliveryChangeRequest | null {
  const last = record.deliveryChangeRequests.at(-1) ?? null;
  return last !== null && last.answer === null ? last : null;
}

/** Το τελευταίο **απαντημένο** αίτημα — ό,τι λέει η οθόνη του μηχανικού «το γραφείο απάντησε». */
export function lastAnsweredDeliveryChangeOf(record: ChangeRecord): DeliveryChangeRequest | null {
  const last = record.deliveryChangeRequests.at(-1) ?? null;
  return last !== null && last.answer !== null ? last : null;
}

function normalizedReason(reason: string | null): string | null {
  const text = reason?.trim() ?? '';
  return text !== '' && text.length <= DELIVERY_CHANGE_POLICY.reasonMax ? text : null;
}

function withAnswer(record: IssuanceAssignmentRecord, answer: DeliveryChangeAnswer): IssuanceAssignmentRecord {
  const requests = record.deliveryChangeRequests;
  return { ...record, deliveryChangeRequests: [...requests.slice(0, -1), { ...requests[requests.length - 1], answer }] };
}

/**
 * **Η κρίση του αιτήματος**: άκυρη, παρελθούσα ή ίδια με την τρέχουσα ημέρα, κενή αιτιολογία ή γεμάτο ιστορικό ⇒
 * `terms-refused`· ίδιο με το εκκρεμές ⇒ `changed: false`· **άλλο** εκκρεμές ⇒ `transition-refused`.
 */
export function requestedDeliveryChange(
  record: IssuanceAssignmentRecord,
  action: IssuanceRequestDeliveryChangeAction,
  by: { readonly uid: string; readonly engagementId: string; readonly nowIso: string },
): IssuanceReduction {
  const reason = normalizedReason(action.reason);
  const today = conveyanceToday(new Date(by.nowIso));
  if (reason === null || !isDateKey(action.dueOn) || action.dueOn < today) return { ok: false, refusal: 'terms-refused' };
  if (issuanceDeliveryOf(record)?.dueOn === action.dueOn) return { ok: false, refusal: 'terms-refused' };
  const pending = pendingDeliveryChangeOf(record);
  if (pending !== null) {
    const same = pending.dueOn === action.dueOn && pending.reason === reason && pending.engagementId === by.engagementId;
    return same ? { ok: true, record, changed: false } : { ok: false, refusal: 'transition-refused' };
  }
  if (record.deliveryChangeRequests.length >= DELIVERY_CHANGE_POLICY.maxEntries) return { ok: false, refusal: 'terms-refused' };
  const request: DeliveryChangeRequest = {
    dueOn: action.dueOn, reason, at: by.nowIso, byUid: by.uid, engagementId: by.engagementId, answer: null,
  };
  return { ok: true, record: { ...record, deliveryChangeRequests: [...record.deliveryChangeRequests, request] }, changed: true };
}

/** Η απόρριψη — μόνο με εκκρεμές αίτημα (`transition-refused`), μόνο με αιτιολογία (`terms-refused`). */
export function declinedDeliveryChange(
  record: IssuanceAssignmentRecord,
  action: IssuanceDeclineDeliveryChangeAction,
  uid: string,
  nowIso: string,
): IssuanceReduction {
  if (pendingDeliveryChangeOf(record) === null) return { ok: false, refusal: 'transition-refused' };
  const reason = normalizedReason(action.reason);
  if (reason === null) return { ok: false, refusal: 'terms-refused' };
  return { ok: true, record: withAnswer(record, { outcome: 'declined', dueOn: null, reason, at: nowIso, byUid: uid }), changed: true };
}

/**
 * Η **αποδοχή** — καλείται από τον μειωτή μετά από `schedule-delivery` που **άλλαξε** την προθεσμία: αν εκκρεμεί αίτημα,
 * το σημειώνει `accepted` με την ημέρα και την αιτιολογία της καταχώρισης. Χωρίς εκκρεμές ⇒ η εγγραφή ως έχει.
 */
export function withDeliveryChangeAccepted(record: IssuanceAssignmentRecord, uid: string, nowIso: string): IssuanceAssignmentRecord {
  if (pendingDeliveryChangeOf(record) === null) return record;
  const entry = record.deliverySchedule.at(-1) ?? null;
  return withAnswer(record, { outcome: 'accepted', dueOn: entry?.dueOn ?? null, reason: entry?.reason ?? null, at: nowIso, byUid: uid });
}

/** Ποια μετάβαση έγινε σε αυτή τη γραφή — για την ειδοποίηση (γραφείο: νέο αίτημα · μηχανικός: απάντηση). */
export type DeliveryChangeTransition =
  | { readonly kind: 'requested'; readonly request: DeliveryChangeRequest }
  | { readonly kind: 'answered'; readonly request: DeliveryChangeRequest & { readonly answer: DeliveryChangeAnswer } };

/**
 * Παράγεται από την εγγραφή **που γράφτηκε** και τη στιγμή της γραφής (`nowIso` της μείωσης): αίτημα ή απάντηση με
 * **αυτή** τη στιγμή ⇒ γεννήθηκε τώρα. Ιδεμποτής επανάληψη (`changed: false`) δεν γράφει ⇒ κανείς δεν τη ρωτά.
 */
export function deliveryChangeTransitionAt(written: ChangeRecord, nowIso: string): DeliveryChangeTransition | null {
  const last = written.deliveryChangeRequests.at(-1) ?? null;
  if (last === null) return null;
  if (last.answer === null) return last.at === nowIso ? { kind: 'requested', request: last } : null;
  return last.answer.at === nowIso ? { kind: 'answered', request: { ...last, answer: last.answer } } : null;
}

/**
 * §45.20 Φ6γ — «Νέα ημερομηνία» **από τη θέση του επαγγελματία**. 🔒 Ε-9′: μόνο ημερομηνίες και αιτιολογίες — ποιος
 * απάντησε στο γραφείο (`byUid`) **δεν** ταξιδεύει. Μόνο αιτήματα της **δικής του** συμμετοχής.
 */
export interface DeliveryChangeGlance {
  /** Το εκκρεμές αίτημα — όσο υπάρχει, νέο αίτημα δεν γίνεται (ένα τη φορά). */
  readonly pending: { readonly dueOn: string; readonly reason: string; readonly at: string } | null;
  /** Η απάντηση στο τελευταίο απαντημένο αίτημα — `null` όταν δεν υπάρχει ή όταν εκκρεμεί νεότερο. */
  readonly lastAnswer: {
    readonly requestedDueOn: string;
    readonly outcome: DeliveryChangeOutcome;
    /** `accepted` ⇒ η ημερομηνία που **όρισε** το γραφείο (μπορεί να διαφέρει από τη ζητούμενη). */
    readonly dueOn: string | null;
    readonly reason: string | null;
    readonly at: string;
  } | null;
}

/** Η όψη για **μία** συμμετοχή — από τους ίδιους κριτές (`pending…` / `lastAnswered…`) με τη μείωση. */
export function deliveryChangeGlanceOf(record: ChangeRecord, engagementId: string): DeliveryChangeGlance {
  const own = { deliveryChangeRequests: record.deliveryChangeRequests.filter((r) => r.engagementId === engagementId) };
  const pending = pendingDeliveryChangeOf(own);
  const answered = lastAnsweredDeliveryChangeOf(own);
  return {
    pending: pending === null ? null : { dueOn: pending.dueOn, reason: pending.reason, at: pending.at },
    lastAnswer: answered === null || answered.answer === null ? null : {
      requestedDueOn: answered.dueOn, outcome: answered.answer.outcome,
      dueOn: answered.answer.dueOn, reason: answered.answer.reason, at: answered.answer.at,
    },
  };
}
