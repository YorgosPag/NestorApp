/**
 * Baseline Drift Summary (ADR-674) — ΤΟ ΔΙΑΦΟΡΟΠΟΙΗΤΙΚΟ
 *
 * Συγκεντρώνει την **ανά item** απόκλιση που υπολογίζει το
 * `computeBaselineDrift()` σε μία σύνοψη συνόλου. Καμία αριθμητική δεν
 * ξαναγράφεται εδώ — η μηχανή παραμένει η μόνη πηγή αριθμών (ADR-734 §9).
 *
 * **Η κρίσιμη διάκριση**: `null` σημαίνει «κανένα item δεν παρακολουθείται»·
 * `driftedItemCount: 0` σημαίνει «ελέγχθηκαν και δεν αποκλίνουν». Για πράκτορα
 * που παρουσιάζει αριθμό προς υπογραφή, το «δεν κοίταξε κανείς» και το
 * «κοιτάχτηκε, καθαρό» δεν επιτρέπεται να μοιάζουν ίδια.
 *
 * ⚠️ Το `netQuantityDelta` αθροίζει ποσότητες: επιστρέφεται **μόνο** όταν το
 * σύνολο έχει ενιαία μονάδα. m³ σκυροδέματος + kg χάλυβα δεν αθροίζονται —
 * ένα άθροισμα ετερογενών μονάδων θα ήταν σφάλμα **τιμής**, όχι μορφής.
 *
 * @module services/agent-capability/vqe/baseline-drift-summary
 * @see ADR-674, ADR-734 §6.2
 */

import type { BOQItem } from '@/types/boq';
// Βαθύ import: αποφυγή του singleton `boqService` του barrel (βλ. engine-version).
import { computeBaselineDrift } from '@/services/measurements/cost-engine';
import type { BaselineDriftSummary } from '@/types/vqe';
import { type Derived, envelopeIssue } from './derived';
import { compareCodeUnits, uniqueSortedStrings } from './ordering';

/** Απόκλιση ενός item, συνδεδεμένη με την ταυτότητά του. */
interface ItemDrift {
  readonly itemId: string;
  readonly delta: number;
  readonly absPercent: number;
}

/** True όταν το item κουβαλά καταγεγραμμένη live ποσότητα (άρα παρακολουθείται). */
function isTracked(item: BOQItem): boolean {
  return item.liveQuantity !== null && item.liveQuantity !== undefined;
}

/** Οι πραγματικές αποκλίσεις, με το `computeBaselineDrift()` ως μόνη πηγή αριθμών. */
function collectDrifts(items: readonly BOQItem[]): readonly ItemDrift[] {
  const drifts: ItemDrift[] = [];
  for (const item of items) {
    const drift = computeBaselineDrift(item);
    if (drift === null) continue;
    drifts.push({ itemId: item.id, delta: drift.delta, absPercent: Math.abs(drift.percent) });
  }
  return drifts;
}

/** Το πιο πρόσφατο `liveQuantitySyncedAt` (ISO 8601 UTC ⇒ λεξικογραφική σύγκριση). */
function latestSync(items: readonly BOQItem[]): string | null {
  let latest: string | null = null;
  for (const item of items) {
    const syncedAt = item.liveQuantitySyncedAt;
    if (typeof syncedAt !== 'string' || syncedAt.length === 0) continue;
    if (latest === null || compareCodeUnits(syncedAt, latest) > 0) latest = syncedAt;
  }
  return latest;
}

/** Το item με τη μεγαλύτερη απόλυτη ποσοστιαία απόκλιση (ισοπαλία: μικρότερο id). */
function worstDrift(drifts: readonly ItemDrift[]): ItemDrift | null {
  let worst: ItemDrift | null = null;
  for (const drift of drifts) {
    if (
      worst === null ||
      drift.absPercent > worst.absPercent ||
      (drift.absPercent === worst.absPercent && compareCodeUnits(drift.itemId, worst.itemId) < 0)
    ) {
      worst = drift;
    }
  }
  return worst;
}

/**
 * Σύνοψη απόκλισης baseline για το σύνολο.
 *
 * @param items - Τα items που συνεισέφεραν στην τιμή
 * @param hasUniformUnit - True όταν το σύνολο έχει ενιαία μονάδα μέτρησης
 */
export function summarizeBaselineDrift(
  items: readonly BOQItem[],
  hasUniformUnit: boolean,
): Derived<BaselineDriftSummary | null> {
  const tracked = items.filter(isTracked);
  if (tracked.length === 0) return { result: null, warnings: [] };

  const drifts = collectDrifts(items);
  const worst = worstDrift(drifts);

  const result: BaselineDriftSummary = {
    trackedItemCount: tracked.length,
    driftedItemCount: drifts.length,
    totalItemCount: items.length,
    maxAbsPercent: worst?.absPercent ?? 0,
    netQuantityDelta: hasUniformUnit ? drifts.reduce((sum, d) => sum + d.delta, 0) : null,
    worstItemId: worst?.itemId ?? null,
    latestSyncedAt: latestSync(tracked),
  };

  const warnings =
    drifts.length > 0
      ? [
          envelopeIssue('baseline_drift_present', {
            itemIds: uniqueSortedStrings(drifts.map((d) => d.itemId)),
            field: 'liveQuantity',
          }),
        ]
      : [];

  return { result, warnings };
}
