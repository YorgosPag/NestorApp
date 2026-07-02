/**
 * ADR-449 PART B Slice C (2D) — 2D finish-face pick (pure SSoT).
 *
 * Στο 3D το picking χτυπά τον πυρήνα → `side:i` (ADR-539). Στο 2D **δεν υπάρχει** face-pick
 * infra· το merged σοβά-blanket δεν κουβαλά ownership. Λύση με ΤΟ ΙΔΙΟ μοντέλο (element +
 * edge index): για ένα world click, βρες την **πλησιέστερη ακμή footprint** ανάμεσα στα
 * finish-active στοιχεία, εντός band = πάχος σοβά (mm→canvas) + click tolerance. Η ακμή i
 * δίνει `side:i` → ίδιο `SetFinishFaceOverrideCommand` writer με το 3D (μηδέν διπλό write path).
 *
 * Ο σοβάς σχεδιάζεται **έξω** από την ακμή· clamped point-segment distance (reuse του guides
 * SSoT) πιάνει ΚΑΙ ένα κλικ πάνω στη λωρίδα σοβά (έξω) ΚΑΙ κοντά στην ακμή (μέσα) → nearest
 * wins. Οι ακμές ενός στοιχείου απέχουν ≫ band (πλάτος ≥ εκατοντάδες mm) → μηδέν αμφισημία.
 *
 * Pure: μηδέν globals/React/scene — 100% testable.
 *
 * @see ./finish-face-override-ops.ts — finishFaceRefForFaceKey (`side:i`→ref), κοινό key
 * @see core/commands/entity-commands/SetFinishFaceOverrideCommand.ts — ο κοινός writer (2D+3D)
 * @see docs/centralized-systems/reference/adrs/ADR-449-structural-finish-skin.md §PART B
 */

import type { Pt2 } from '../geometry/shared/segment-polygon-coverage';
import { pointToSegmentDistance } from '../../systems/guides';
import { finishFaceRef, type FinishFaceRef } from './structural-finish-face-ref';
import { isFinishActive, type StructuralFinishSpec } from './structural-finish-types';

/** Ένα finish-active στοιχείο με το stored footprint του (canvas units). */
export interface FinishPickElement {
  readonly id: string;
  readonly footprint: readonly Pt2[];
  readonly finish: StructuralFinishSpec | undefined;
}

/** Αποτέλεσμα pick: ποιο element + ποια ακμή (→ `side:edgeIndex` για τον command) + το ref. */
export interface FinishFacePick {
  readonly elementId: string;
  readonly edgeIndex: number;
  readonly ref: FinishFaceRef;
}

/**
 * Πλησιέστερη όψη σοβά στο `point` (canvas units), ή `null` όταν καμία εντός band. `scale` =
 * canvas units ανά mm (`mmToSceneUnits`)· `tolWorld` = επιπλέον click margin (canvas units,
 * π.χ. λίγα px σε world). Band ανά στοιχείο = μεγαλύτερο πάχος (εξωτ. ?? εσωτ.) × scale + tol.
 */
export function pickFinishFaceAtPoint(
  point: Pt2,
  elements: readonly FinishPickElement[],
  scale: number,
  tolWorld = 0,
): FinishFacePick | null {
  let bestDist = Infinity;
  let best: FinishFacePick | null = null;
  for (const el of elements) {
    if (!isFinishActive(el.finish) || el.footprint.length < 3) continue;
    const band = (el.finish.exteriorThickness ?? el.finish.thickness) * scale + tolWorld;
    const n = el.footprint.length;
    for (let i = 0; i < n; i++) {
      const a = el.footprint[i];
      const b = el.footprint[(i + 1) % n];
      const d = pointToSegmentDistance(point, a, b);
      if (d > band || d >= bestDist) continue;
      bestDist = d;
      best = { elementId: el.id, edgeIndex: i, ref: finishFaceRef(a, b) };
    }
  }
  return best;
}
