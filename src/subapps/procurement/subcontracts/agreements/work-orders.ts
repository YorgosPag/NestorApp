/**
 * @fileoverview **Οι εντολές εργασίας μιας κύριας σύμβασης** — αρίθμηση, κρίση «μπορεί να δοθεί;», προηγούμενη εντολή
 *   στο ίδιο έργο (ADR-928 §5.24 · AIA A421/A422 · ConsensusDocs 755/756). Καθαρό: το διαβάζουν η οθόνη και το έγγραφο.
 * @module subapps/procurement/subcontracts/agreements/work-orders
 *
 * 🔑 **Ο αριθμός είναι η θέση**: ο γραφέας μόνο **προσθέτει** στο `assignments` (`addSubcontractAgreementAssignment`),
 *    ποτέ δεν αφαιρεί ή αναδιατάσσει ⇒ η ΕΕ-3 είναι ΕΕ-3 για πάντα, χωρίς μετρητή και χωρίς δεύτερη πηγή αλήθειας.
 * 🔑 Η κρίση είναι **του γραφέα** (`refuseAssignment`) + το δικαίωμα στο **έργο-στόχο** — ποτέ μια τρίτη λογική.
 */

import { refuseAssignment, type AgreementLifecycleRefusal } from './agreement-lifecycle';
import type { SiteAssignment, SubcontractAgreement } from '../types/agreement';

export interface WorkOrder {
  /** 1, 2, 3… — η σειρά έκδοσης, σταθερή. */
  readonly number: number;
  readonly assignment: SiteAssignment;
}

/** Οι εντολές με τη σειρά έκδοσης· `[]` για συμφωνητικό ενός έργου. */
export function workOrdersOf(agreement: Pick<SubcontractAgreement, 'scope'>): WorkOrder[] {
  if (agreement.scope.kind !== 'multi_project') return [];
  return agreement.scope.assignments.map((assignment, index) => ({ number: index + 1, assignment }));
}

/** Η πιο πρόσφατη εντολή προς το έργο — ενημέρωση, όχι φραγμός: ο γραφέας δέχεται και νέα εντολή στο ίδιο έργο. */
export function latestWorkOrderFor(agreement: Pick<SubcontractAgreement, 'scope'>, projectId: string): WorkOrder | null {
  const matching = workOrdersOf(agreement).filter((order) => order.assignment.project.projectId === projectId);
  return matching.length > 0 ? matching[matching.length - 1] : null;
}

/** Δικαίωμα εντολής στο έργο-στόχο (`useWorkOrderTargetAuthority`). */
export type WorkOrderTargetVerdict = 'granted' | 'denied' | 'pending';

export type WorkOrderBlock =
  | { readonly kind: 'refusal'; readonly refusal: AgreementLifecycleRefusal }
  | { readonly kind: 'noTarget' }
  | { readonly kind: 'checking' }
  | { readonly kind: 'denied' };

/** Γιατί **δεν** μπορεί να δοθεί εντολή τώρα — `null` ⇒ μπορεί. Η σειρά: πρώτα η σύμβαση, μετά ο στόχος, μετά το δικαίωμα. */
export function workOrderBlock(
  agreement: Pick<SubcontractAgreement, 'status' | 'scope'>,
  targetProjectId: string | null,
  verdict: WorkOrderTargetVerdict,
): WorkOrderBlock | null {
  const refusal = refuseAssignment(agreement);
  if (refusal) return { kind: 'refusal', refusal };
  if (!targetProjectId) return { kind: 'noTarget' };
  if (verdict === 'pending') return { kind: 'checking' };
  return verdict === 'denied' ? { kind: 'denied' } : null;
}

/** Οι κύριες συμβάσεις που **δέχονται** εντολή τώρα — για τον διάλογο που ανοίγει από ένα έργο. */
export function assignableMasters(agreements: readonly SubcontractAgreement[]): SubcontractAgreement[] {
  return agreements.filter((agreement) => refuseAssignment(agreement) === null);
}
