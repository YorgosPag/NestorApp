/**
 * @fileoverview **Η κατάσταση μιας γραμμής χωρίς πεδίο** (ADR-923 §5.5.2 Β3 Γ8) — καθαρή, από **ένα** σημείο. Τη διαβάζουν η λίστα
 *   των γραμμών (`ProposalUnmappedLines`) και ο χάρτης κατάστασης του PDF (§5.5.2 Β8), ώστε το πλαίσιο και η ετικέτα να μη
 *   διαφωνούν ποτέ.
 * @module components/catalog/imports/line-state
 */

import type { ImportLineDecision } from '@/subapps/catalog/types/catalog-import';
import type { LineState } from './import-text';
import type { LineActivity } from './use-line-decisions';

/** Η δραστηριότητα της στιγμής (αποθήκευση · άρνηση) νικά· αλλιώς η απόφαση της παρτίδας. */
export function lineStateOf(activity: LineActivity | undefined, decision: ImportLineDecision | null): LineState {
  if (activity) return activity.kind;
  if (decision?.kind === 'ignore') return 'ignored';
  return decision?.kind === 'attribute' || decision?.kind === 'axis' || decision?.kind === 'price' ? 'mapped' : 'pending';
}
