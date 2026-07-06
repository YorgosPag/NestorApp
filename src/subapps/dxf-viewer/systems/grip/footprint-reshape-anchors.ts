/**
 * FOOTPRINT RESHAPE ANCHORS — SSoT για τα «σταθερά σημεία» μιας reshape λαβής πολυγωνικού footprint
 * (ADR-508 §grip-tracking, Giorgio 2026-07-06).
 *
 * Όταν σέρνεις μια ΚΟΡΥΦΗ ή μια ΜΕΣΑΙΑ ΛΑΒΗ (edge-midpoint insert) ενός πολυγωνικού BIM entity
 * (κολόνα / πλάκα / άνοιγμα / στέγη / επένδυση / ενδοδαπέδια), τα ίχνη ευθυγράμμισης (λευκά acquired
 * ⊕ κυανά ambient) και το POLAR ray χρειάζονται:
 *   · alignment anchors → οι ΣΤΑΘΕΡΕΣ κορυφές (όλες εκτός της κινούμενης) ώστε το κινούμενο σημείο να
 *     ευθυγραμμίζεται H/V με κάθε άλλη κορυφή· και
 *   · polar origin → ΕΝΑΣ σταθερός γείτονας γύρω από τον οποίο κλειδώνει η γωνία (όπως το άκρο γραμμής
 *     pivot-άρει γύρω από τον σταθερό γείτονα).
 *
 * Entity-agnostic: δουλεύει με το ordered polygon (`getBimCharacteristicPointsOfCategory(entity,
 * 'corner')`) + το index που είναι ΗΔΗ κωδικοποιημένο στο grip-kind string — μηδέν point-matching,
 * μηδέν νέος geometry κώδικας. Reuse των `parseGripKindIndex` + `getPolylineVertexNeighbourIndices`.
 *
 * @module systems/grip/footprint-reshape-anchors
 * @see systems/grip/grip-kind-index.ts — parseGripKindIndex (trailing `-N`)
 * @see systems/polyline/polyline-grips.ts — getPolylineVertexNeighbourIndices (prev/next, closed ring)
 */

import type { Point2D } from '../../rendering/types/Types';
import { parseGripKindIndex } from './grip-kind-index';
import { getPolylineVertexNeighbourIndices } from '../polyline/polyline-grips';

/** Μετακίνηση ΥΠΑΡΧΟΥΣΑΣ κορυφής (`slab-vertex-N`, `column-poly-vertex-N`, `roof-vertex-N`, …). */
const VERTEX_GRIP_RE = /-vertex-\d+$/;
/** Εισαγωγή ΝΕΑΣ κορυφής στη μέση ακμής (`slab-edge-midpoint-N`, `column-poly-edge-N`, …). */
const EDGE_MIDPOINT_GRIP_RE = /(-edge-midpoint|-poly-edge)-\d+$/;

/** Τα footprint reshape grip-kind discriminators ενός preview `dp` ή commit `grip`. */
export interface FootprintGripKinds {
  readonly columnGripKind?: string;
  readonly slabGripKind?: string;
  readonly slabOpeningGripKind?: string;
  readonly openingGripKind?: string;
  readonly roofGripKind?: string;
  readonly floorFinishGripKind?: string;
  readonly mepUnderfloorGripKind?: string;
}

/**
 * Το ΕΝΑ ενεργό polygon-footprint reshape grip-kind string (ή `undefined`). Κοινό preview+commit —
 * ώστε τα ίχνη ευθυγράμμισης/POLAR να προκύπτουν από την ΙΔΙΑ πηγή και στα δύο seams (WYSIWYG).
 */
export function resolveActiveFootprintGripKind(k: FootprintGripKinds): string | undefined {
  return k.columnGripKind ?? k.slabGripKind ?? k.slabOpeningGripKind ?? k.openingGripKind
    ?? k.roofGripKind ?? k.floorFinishGripKind ?? k.mepUnderfloorGripKind;
}

/**
 * Οι ΣΤΑΘΕΡΕΣ κορυφές (alignment anchors) για μια reshape λαβή. Vertex grip → όλες εκτός της
 * κινούμενης κορυφής `idx`· edge-midpoint / παρειά / parametric → όλες οι κορυφές (η κινούμενη
 * είτε είναι νέα στη μέση ακμής είτε είναι παρειά — καμία υπάρχουσα κορυφή δεν «φεύγει»). `[]` αν
 * δεν υπάρχει grip-kind ή <2 κορυφές.
 */
export function getFootprintReshapeAlignmentAnchors(
  corners: readonly Point2D[],
  gripKind: string | undefined,
): Point2D[] {
  if (!gripKind || corners.length < 2) return [];
  if (VERTEX_GRIP_RE.test(gripKind)) {
    const idx = parseGripKindIndex(gripKind);
    if (idx === null || idx >= corners.length) return corners.slice();
    return corners.filter((_, i) => i !== idx);
  }
  return corners.slice();
}

/**
 * Ο σταθερός polar origin (pivot) για μια reshape λαβή, ή `null` όταν το POLAR angle-lock δεν έχει
 * νόημα. Vertex grip → ο `prev` γείτονας στο closed ring (η κινούμενη κορυφή pivot-άρει γύρω του,
 * όπως το άκρο γραμμής)· edge-midpoint → το πρώτο άκρο της ακμής (η νέα κορυφή ξεκινά στη μέση)·
 * **παρειά / parametric / corner κολόνας → `null`** (single-axis resize, το angle-lock είναι άσχετο).
 */
export function getFootprintReshapePolarAnchor(
  corners: readonly Point2D[],
  gripKind: string | undefined,
): Point2D | null {
  if (!gripKind || corners.length < 2) return null;
  const idx = parseGripKindIndex(gripKind);
  if (idx === null || idx >= corners.length) return null;
  if (VERTEX_GRIP_RE.test(gripKind)) {
    const { prev } = getPolylineVertexNeighbourIndices(idx, corners.length, true);
    return prev !== null ? corners[prev] : null;
  }
  if (EDGE_MIDPOINT_GRIP_RE.test(gripKind)) {
    return corners[idx];
  }
  return null;
}
