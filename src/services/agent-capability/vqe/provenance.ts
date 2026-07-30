/**
 * Provenance — «από πού βγήκε;» (W3C PROV-O aligned)
 *
 * Δύο ευθύνες:
 *  1. **Υγιεινή εισόδων** — ό,τι μπορεί να διαβρώσει την αξιοπιστία του αριθμού
 *     χωρίς να τον αλλάξει: κενό σύνολο, διπλοεγγραφές, μη πεπερασμένες τιμές.
 *     Επισημαίνονται· **ΠΟΤΕ δεν διορθώνονται** — το `value` παραμένει ακριβώς
 *     ό,τι επέστρεψε το service (ADR-734 §6.3 κανόνας 3).
 *  2. **Συναρμολόγηση του `ProvenanceRecord`** με ντετερμινιστική σειρά
 *     αναγνωριστικών και προειδοποιήσεων — αλλιώς δύο πανομοιότυπες κλήσεις θα
 *     παρήγαγαν διαφορετικό φάκελο.
 *
 * @module services/agent-capability/vqe/provenance
 * @see ADR-734 §6.2 (ProvenanceRecord)
 */

import type { BOQItem } from '@/types/boq';
import type { EnvelopeWarning, ProvenanceActivity, ProvenanceRecord } from '@/types/vqe';
import { canonicalize } from './canonical-encoding';
import { envelopeIssue } from './derived';
import { compareCodeUnits, uniqueSortedStrings } from './ordering';

/** Τα αριθμητικά πεδία του item που τροφοδοτούν υπολογισμό — όλα ελέγχονται. */
const NUMERIC_FIELDS: readonly (readonly [string, (item: BOQItem) => number | null | undefined])[] =
  [
    ['estimatedQuantity', (item) => item.estimatedQuantity],
    ['actualQuantity', (item) => item.actualQuantity],
    ['liveQuantity', (item) => item.liveQuantity],
    ['wasteFactor', (item) => item.wasteFactor],
    ['materialUnitCost', (item) => item.materialUnitCost],
    ['laborUnitCost', (item) => item.laborUnitCost],
    ['equipmentUnitCost', (item) => item.equipmentUnitCost],
  ];

/** Ids που εμφανίζονται περισσότερες από μία φορά στο σύνολο. */
function duplicateIds(items: readonly BOQItem[]): readonly string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) duplicates.add(item.id);
    seen.add(item.id);
  }
  return [...duplicates];
}

/** Ανά πεδίο, τα items με μη πεπερασμένη τιμή (NaN / ±Infinity). */
function nonFiniteByField(items: readonly BOQItem[]): ReadonlyMap<string, readonly string[]> {
  const offenders = new Map<string, string[]>();
  for (const item of items) {
    for (const [field, pick] of NUMERIC_FIELDS) {
      const value = pick(item);
      if (value === null || value === undefined || Number.isFinite(value)) continue;
      const bucket = offenders.get(field) ?? [];
      bucket.push(item.id);
      offenders.set(field, bucket);
    }
  }
  return offenders;
}

/**
 * Έλεγχος υγιεινής του συνόλου πηγής. Δεν μεταβάλλει τίποτα — μόνο αναφέρει.
 */
export function scanSourceItems(items: readonly BOQItem[]): readonly EnvelopeWarning[] {
  const warnings: EnvelopeWarning[] = [];

  if (items.length === 0) warnings.push(envelopeIssue('no_source_items'));

  const duplicates = duplicateIds(items);
  if (duplicates.length > 0) {
    warnings.push(envelopeIssue('duplicate_source_items', { itemIds: uniqueSortedStrings(duplicates) }));
  }

  for (const [field, itemIds] of nonFiniteByField(items)) {
    warnings.push(
      envelopeIssue('non_finite_quantity', { field, itemIds: uniqueSortedStrings(itemIds) }),
    );
  }

  return warnings;
}

/**
 * Ντετερμινιστική σειρά προειδοποιήσεων: ταξινόμηση κατά την κανονική τους
 * κωδικοποίηση. Ανεξάρτητη από τη σειρά με την οποία τις ανακάλυψαν τα επιμέρους
 * στάδια, άρα σταθερή μεταξύ εκτελέσεων.
 */
function orderWarnings(warnings: readonly EnvelopeWarning[]): readonly EnvelopeWarning[] {
  return [...warnings].sort((a, b) => compareCodeUnits(canonicalize(a), canonicalize(b)));
}

/** Είσοδοι συναρμολόγησης του ίχνους προέλευσης. */
export interface ProvenanceInputs {
  readonly items: readonly BOQItem[];
  readonly computedBy: ProvenanceActivity;
  readonly computedAt: string;
  readonly warnings: readonly EnvelopeWarning[];
}

/** Το `ProvenanceRecord` του φακέλου. */
export function buildProvenanceRecord(inputs: ProvenanceInputs): ProvenanceRecord {
  const sourceEntityIds = inputs.items
    .map((item) => item.sourceEntityId)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);

  return {
    sourceItemIds: uniqueSortedStrings(inputs.items.map((item) => item.id)),
    sourceEntityIds: uniqueSortedStrings(sourceEntityIds),
    computedBy: inputs.computedBy,
    computedAt: inputs.computedAt,
    warnings: orderWarnings(inputs.warnings),
  };
}
