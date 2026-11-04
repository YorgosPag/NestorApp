/**
 * @fileoverview **Οι κανόνες του πίνακα ροής πωλήσεων — καθαροί** (ADR-929): ταξινόμηση, σύνολα στήλης, «μέρες στο στάδιο».
 * @module components/crm/utils/pipeline-board
 *
 * 🔑 **Καμία χειροκίνητη σειρά μέσα στη στήλη** (πρακτική Pipedrive/HubSpot/Salesforce): η σειρά είναι κανόνας που
 *    διαλέγει ο καθένας για τον εαυτό του, ώστε η ταξινόμηση ενός χρήστη να μη χαλάει τη σειρά των άλλων.
 * 🔑 **Σταθμισμένο σύνολο** = Σ αξία × πιθανότητα (Salesforce «expected revenue»): αυτό λέει τι θα κλείσει
 *    ρεαλιστικά, όχι το σκέτο άθροισμα. Πιθανότητα που λείπει ⇒ η προεπιλογή του σταδίου.
 */

import { stageSpec } from '@/config/crm/opportunity-stages';
import { daysSinceOrNull, normalizeToMillisOrNull } from '@/lib/date-local';
import type { Opportunity } from '@/types/crm';

export const PIPELINE_SORTS = ['value', 'closeDate', 'activity', 'stageAge'] as const;
export type PipelineSort = (typeof PIPELINE_SORTS)[number];
export const DEFAULT_PIPELINE_SORT: PipelineSort = 'activity';

export function isPipelineSort(value: unknown): value is PipelineSort {
  return typeof value === 'string' && (PIPELINE_SORTS as readonly string[]).includes(value);
}

/** Πότε μπήκε στο τρέχον στάδιο — `stageChangedAt`, αλλιώς (παλιές εγγραφές) η δημιουργία. */
export function stageEnteredAt(opportunity: Opportunity): number | null {
  return normalizeToMillisOrNull(opportunity.stageChangedAt) ?? normalizeToMillisOrNull(opportunity.createdAt);
}

export interface StageAge {
  readonly days: number;
  readonly stale: boolean;
}

/** Μέρες στο στάδιο + αν πέρασε το όριο του σταδίου (Pipedrive rotting). `null` ⇒ άγνωστη ημερομηνία. */
export function stageAgeOf(opportunity: Opportunity, now: number = Date.now()): StageAge | null {
  const days = daysSinceOrNull(opportunity.stageChangedAt ?? opportunity.createdAt, now);
  if (days === null) return null;
  const limit = stageSpec(opportunity.stage).staleAfterDays;
  return { days, stale: limit !== null && days > limit };
}

/** Μεγαλύτερο πρώτα· άγνωστο στο τέλος· ισοπαλία ⇒ σταθερά κατά αναγνωριστικό (ίδια σειρά σε κάθε φόρτωση). */
function descending(a: number | null, b: number | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b - a;
}

const SORT_KEY: Readonly<Record<PipelineSort, (o: Opportunity) => number | null>> = {
  value: (o) => o.estimatedValue ?? null,
  // Το πιο κοντινό κλείσιμο πρώτο ⇒ αρνητικό για να δουλέψει η φθίνουσα σύγκριση.
  closeDate: (o) => { const ms = normalizeToMillisOrNull(o.expectedCloseDate); return ms === null ? null : -ms; },
  activity: (o) => normalizeToMillisOrNull(o.lastActivity) ?? normalizeToMillisOrNull(o.updatedAt),
  // Η πιο «παγωμένη» πρώτη ⇒ η παλαιότερη είσοδος στο στάδιο.
  stageAge: (o) => { const ms = stageEnteredAt(o); return ms === null ? null : -ms; },
};

export function sortOpportunities(opportunities: readonly Opportunity[], sort: PipelineSort): Opportunity[] {
  const key = SORT_KEY[sort];
  return [...opportunities].sort((a, b) => descending(key(a), key(b)) || (a.id ?? '').localeCompare(b.id ?? ''));
}

export interface ColumnTotals {
  readonly count: number;
  readonly total: number;
  readonly weighted: number;
}

export function columnTotals(opportunities: readonly Opportunity[]): ColumnTotals {
  return opportunities.reduce<ColumnTotals>((acc, o) => {
    const value = o.estimatedValue ?? 0;
    const probability = o.probability ?? stageSpec(o.stage).defaultProbability;
    return { count: acc.count + 1, total: acc.total + value, weighted: acc.weighted + (value * probability) / 100 };
  }, { count: 0, total: 0, weighted: 0 });
}
