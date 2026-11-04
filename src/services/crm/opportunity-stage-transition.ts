/**
 * @fileoverview **Ο κανόνας μιας αλλαγής σταδίου ευκαιρίας — καθαρός, χωρίς I/O** (ADR-929).
 * @module services/crm/opportunity-stage-transition
 *
 * Ο server (`opportunity-stage-transition.server.ts`) τον εκτελεί μέσα σε συναλλαγή· τα tests τον εκτελούν σκέτο.
 * Ένας κανόνας, δύο εκτελεστές — όχι δύο εκδοχές του ίδιου κανόνα.
 *
 * 🔑 **Πρακτική μεγάλων**:
 *  - Κλείσιμο ως επιτυχία ⇒ τελικό ποσό + ημερομηνία (HubSpot «closed won» properties).
 *  - Κλείσιμο ως απώλεια ⇒ λόγος από **κλειστό κατάλογο** + προαιρετικό σχόλιο (HubSpot/Pipedrive lost reason).
 *  - Αλλαγή σταδίου ⇒ η πιθανότητα παίρνει την προεπιλογή του νέου σταδίου (Salesforce Stage → Probability).
 *  - Από κλειστό σε ανοιχτό = **επανάνοιγμα**: καθαρίζουν τα στοιχεία κλεισίματος, `reopenCount + 1`, το ιστορικό
 *    μένει. (Οι χρήστες Pipedrive παραπονιούνται ότι το επανάνοιγμα χαλά τις αναφορές — εδώ **μετριέται**.)
 *  - Ίδιο στάδιο ⇒ `unchanged`: καμία εγγραφή, καμία γραμμή ιστορικού (ιδεμπότητα).
 * 🔑 Το `status` **παράγεται** από το είδος του σταδίου — ποτέ ανεξάρτητο.
 */

import {
  closingStageOf,
  STATUS_OF_STAGE_KIND,
  stageKind,
  stageSpec,
  type OpportunityStage,
} from '@/config/crm/opportunity-stages';
import {
  isOpportunityLostReason,
  LOST_REASON_NOTE_MAX,
  type OpportunityLostReason,
} from '@/config/crm/opportunity-lost-reasons';

/** Τα στάδια-στόχοι κλεισίματος, από τη ρίζα (ένα ανά είδος). */
export const WON_STAGE = closingStageOf('won');
export const LOST_STAGE = closingStageOf('lost');

export type StageTransitionRequest =
  | { readonly kind: 'open'; readonly target: OpportunityStage }
  | { readonly kind: 'won'; readonly finalValue: number; readonly closedOn: string }
  | { readonly kind: 'lost'; readonly lostReason: OpportunityLostReason; readonly lostReasonNote?: string };

export interface StageTransitionCurrent {
  readonly stage: OpportunityStage;
  readonly reopenCount?: number;
}

export type StageTransitionInvalidReason =
  | 'target_not_open'
  | 'won_value_required'
  | 'won_date_required'
  | 'lost_reason_required'
  | 'lost_note_too_long';

/** Τα πεδία που καθαρίζουν στο επανάνοιγμα — τα στοιχεία ενός κλεισίματος που δεν ισχύει πια. */
export const CLOSING_FIELDS = ['closedAt', 'wonDate', 'lostReason', 'lostReasonNote'] as const;

/**
 * Τα πεδία που γράφει **μόνο** η πόρτα σταδίου — ο κανόνας τα παράγει μαζί με το στάδιο. Η ΜΙΑ λίστα: τη διαβάζουν
 * η πύλη του πελάτη (`crm-mutation-gateway`) και οι κανόνες Firestore/η πύλη «ένας γραφέας» (ADR-929 Φάση 4).
 * ⚠️ Όχι το `probability`: ο άνθρωπος το διορθώνει και από τη φόρμα· η αλλαγή σταδίου απλώς το ξαναθέτει.
 */
export const STAGE_OWNED_FIELDS = [
  'stage', 'status', 'wonDate', 'closedAt', 'stageChangedAt', 'lostReason', 'lostReasonNote', 'reopenCount', '_v',
] as const;

export type StageTransitionPlan =
  | { readonly kind: 'unchanged' }
  | { readonly kind: 'invalid'; readonly reason: StageTransitionInvalidReason }
  | {
      readonly kind: 'apply';
      readonly target: OpportunityStage;
      readonly set: Readonly<Record<string, unknown>>;
      readonly clear: readonly string[];
      readonly reopened: boolean;
    };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function targetOf(request: StageTransitionRequest): OpportunityStage {
  if (request.kind === 'won') return WON_STAGE;
  if (request.kind === 'lost') return LOST_STAGE;
  return request.target;
}

function validate(request: StageTransitionRequest): StageTransitionInvalidReason | null {
  switch (request.kind) {
    case 'open':
      return stageKind(request.target) === 'open' ? null : 'target_not_open';
    case 'won':
      if (!Number.isFinite(request.finalValue) || request.finalValue <= 0) return 'won_value_required';
      return ISO_DATE.test(request.closedOn) ? null : 'won_date_required';
    case 'lost':
      if (!isOpportunityLostReason(request.lostReason)) return 'lost_reason_required';
      return (request.lostReasonNote ?? '').length > LOST_REASON_NOTE_MAX ? 'lost_note_too_long' : null;
  }
}

/** Τα πεδία που γράφει το ίδιο το κλείσιμο (ή κανένα, για ανοιχτό στόχο). */
function closingFieldsOf(request: StageTransitionRequest, nowIso: string): Record<string, unknown> {
  if (request.kind === 'won') {
    return { estimatedValue: request.finalValue, closedAt: request.closedOn, wonDate: request.closedOn };
  }
  if (request.kind === 'lost') {
    // Και η απώλεια έχει ημερομηνία κλεισίματος — αλλιώς οι αναφορές «χαμένα ανά μήνα» δεν βγαίνουν.
    const note = request.lostReasonNote?.trim();
    return { lostReason: request.lostReason, closedAt: nowIso.slice(0, 10), ...(note ? { lostReasonNote: note } : {}) };
  }
  return {};
}

/** Τι πρέπει να γραφτεί ώστε η ευκαιρία να βρεθεί στο στάδιο του αιτήματος. */
export function planStageTransition(
  current: StageTransitionCurrent,
  request: StageTransitionRequest,
  nowIso: string,
): StageTransitionPlan {
  const invalid = validate(request);
  if (invalid) return { kind: 'invalid', reason: invalid };

  const target = targetOf(request);
  if (target === current.stage) return { kind: 'unchanged' };

  const spec = stageSpec(target);
  const reopened = stageKind(current.stage) !== 'open' && spec.kind === 'open';
  const set: Record<string, unknown> = {
    stage: target,
    status: STATUS_OF_STAGE_KIND[spec.kind],
    probability: spec.defaultProbability,
    stageChangedAt: nowIso,
    lastActivity: nowIso,
    ...closingFieldsOf(request, nowIso),
    ...(reopened ? { reopenCount: (current.reopenCount ?? 0) + 1 } : {}),
  };
  // Κάθε στοιχείο κλεισίματος που ΔΕΝ ξαναγράφεται τώρα είναι μπαγιάτικο (επανάνοιγμα, ή won ⇄ lost).
  const clear = CLOSING_FIELDS.filter((field) => !(field in set));
  return { kind: 'apply', target, set, clear, reopened };
}
