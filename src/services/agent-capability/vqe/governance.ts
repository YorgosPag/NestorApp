/**
 * Governance — ISO 19650 ωριμότητα ενός **συνόλου** items
 *
 * ADR-734 §6.3 κανόνας 1 (μη διαπραγματεύσιμος):
 * **το `effectiveStatus` είναι η ΧΑΜΗΛΟΤΕΡΗ κατάσταση του συνόλου.**
 * 99 certified + 1 draft ΔΕΝ είναι certified. Αυτό εμποδίζει τον πράκτορα να
 * παρουσιάσει ως εγκεκριμένο ένα σύνολο που δεν είναι — που είναι ολόκληρος ο
 * λόγος ύπαρξης του φακέλου.
 *
 * **Fail-closed** σε άγνωστη κατάσταση: ένα item με κατεστραμμένο/άγνωστο
 * `status` υποβαθμίζει το σύνολο στο `draft` και σβήνει το `isSignable`. Δεν
 * πετάει εξαίρεση (ένα εργαλείο ανάγνωσης δεν πρέπει να καταρρέει), αλλά ούτε
 * το αποσιωπά: εκπέμπει `unknown_governance_status` με το ωμό περιεχόμενο.
 *
 * @module services/agent-capability/vqe/governance
 * @see ADR-734 §6.2, §6.3 κανόνας 1
 */

import type { BOQItem, BOQItemStatus } from '@/types/boq';
import {
  BOQ_STATUS_LIFECYCLE_ORDER,
  LOWEST_BOQ_ITEM_STATUS,
  boqStatusRank,
  isKnownBoqItemStatus,
  isSignableBoqItemStatus,
} from '@/types/boq';
import type { BaselineDriftSummary, GovernanceRecord } from '@/types/vqe';
import { type Derived, envelopeIssue } from './derived';
import { uniqueSortedStrings } from './ordering';

/** Κατανομή με **όλα** τα κλειδιά παρόντα (μηδενικά όπου δεν υπάρχουν items). */
function emptyBreakdown(): Record<BOQItemStatus, number> {
  const breakdown = {} as Record<BOQItemStatus, number>;
  for (const status of BOQ_STATUS_LIFECYCLE_ORDER) breakdown[status] = 0;
  return breakdown;
}

/** Διαχωρισμός του συνόλου σε αναγνωρισμένες καταστάσεις και σε άγνωστες. */
interface StatusScan {
  readonly breakdown: Record<BOQItemStatus, number>;
  readonly unknownItemIds: readonly string[];
  readonly unknownValues: readonly string[];
}

function scanStatuses(items: readonly BOQItem[]): StatusScan {
  const breakdown = emptyBreakdown();
  const unknownItemIds: string[] = [];
  const unknownValues: string[] = [];

  for (const item of items) {
    if (isKnownBoqItemStatus(item.status)) {
      breakdown[item.status] += 1;
      continue;
    }
    unknownItemIds.push(item.id);
    unknownValues.push(String(item.status));
  }

  return { breakdown, unknownItemIds, unknownValues };
}

/** Η χαμηλότερη αναγνωρισμένη κατάσταση του συνόλου (fail-closed σε κενό). */
function lowestStatus(items: readonly BOQItem[]): BOQItemStatus {
  let lowest: BOQItemStatus | null = null;
  for (const item of items) {
    if (!isKnownBoqItemStatus(item.status)) continue;
    if (lowest === null || boqStatusRank(item.status) < boqStatusRank(lowest)) {
      lowest = item.status;
    }
  }
  return lowest ?? LOWEST_BOQ_ITEM_STATUS;
}

/** Πλήθος διακριτών καταστάσεων με τουλάχιστον ένα item. */
function distinctStatusCount(breakdown: Readonly<Record<BOQItemStatus, number>>): number {
  return BOQ_STATUS_LIFECYCLE_ORDER.filter((status) => breakdown[status] > 0).length;
}

/**
 * `GovernanceRecord` του συνόλου, μαζί με ό,τι πρέπει να ξέρει ο πράκτορας για
 * τη σύνθεσή του.
 */
export function buildGovernanceRecord(
  items: readonly BOQItem[],
  baselineDrift: BaselineDriftSummary | null,
): Derived<GovernanceRecord> {
  const { breakdown, unknownItemIds, unknownValues } = scanStatuses(items);
  const hasUnknown = unknownItemIds.length > 0;
  const effectiveStatus = hasUnknown ? LOWEST_BOQ_ITEM_STATUS : lowestStatus(items);
  const isSignable =
    items.length > 0 && !hasUnknown && items.every((item) => isSignableBoqItemStatus(item.status));

  const warnings = [
    ...(hasUnknown
      ? [
          envelopeIssue('unknown_governance_status', {
            itemIds: uniqueSortedStrings(unknownItemIds),
            field: 'status',
            rawValue: uniqueSortedStrings(unknownValues).join(','),
          }),
        ]
      : []),
    ...(distinctStatusCount(breakdown) + (hasUnknown ? 1 : 0) > 1
      ? [envelopeIssue('mixed_governance_status', { field: 'status' })]
      : []),
  ];

  return {
    result: { effectiveStatus, statusBreakdown: breakdown, isSignable, baselineDrift },
    warnings,
  };
}
