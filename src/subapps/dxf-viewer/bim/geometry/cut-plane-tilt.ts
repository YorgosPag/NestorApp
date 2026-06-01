/**
 * Cut-plane tilt projection SSoT (ADR-404 Phase 3 — Revit-style 2Δ προβολή).
 *
 * Η κεκλιμένη κολώνα/τοίχος (Phase 1+2) φαίνεται ήδη στο 3Δ. Το Phase 3 κάνει τη
 * **2Δ κάτοψη + τις τομές** να δείχνουν την κλίση: το footprint εμφανίζεται
 * **μετατοπισμένο εκεί που το κόβει το επίπεδο τομής** (cut plane, ~1200mm). Αυτό
 * είναι **render-time** προβολή — ΟΧΙ αλλαγή στο `computeColumnGeometry`/
 * `computeWallGeometry` (που μοιράζονται με το 3Δ shear, τα grips, το hit-test και
 * το BOQ· shift εκεί θα **διπλο-μετρούσε** στο 3Δ που ήδη κάνει `applyColumnTilt`).
 *
 * **Datum:** το `cutPlaneMm` είναι mm πάνω από τη βάση του ορόφου (ViewRange,
 * ADR-375). Η μετατόπιση αποτιμάται στο `heightAboveBase = cutPlaneMm − baseOffset`,
 * clamped σε `[0, height]` (στη βάση → μηδέν· πάνω από την κορυφή → η μετατόπιση της
 * κορυφής) — **ίδιο datum με την υπάρχουσα cut-state** στους renderers. Reuse των
 * Phase-1 SSoT `columnTiltShearAt`/`wallTiltShearAt` — **καμία νέα math**.
 *
 * **Unit-safety:** οι `*ShiftMm` επιστρέφουν mm (το `heightAboveBase` δίνεται σε mm).
 * Οι consumers (2Δ renderer / section adapter) πολλαπλασιάζουν με `s` (canvas units
 * ανά mm) για να φέρουν τη μετατόπιση στο plan space των vertices.
 *
 * @see column-tilt.ts / wall-tilt.ts — Phase 1 shear SSoT (raking/battered)
 * @see docs/centralized-systems/reference/adrs/ADR-404-3d-bim-element-tilt.md
 */

import type { ColumnParams } from '../types/column-types';
import type { WallParams } from '../types/wall-types';
import { mmToSceneUnits } from '../../utils/scene-units';
import { columnTiltShearAt, isColumnTilted, type PlanShift } from './column-tilt';
import { wallTiltShearAt, isWallTilted } from './wall-tilt';

const NO_SHIFT: PlanShift = { dx: 0, dy: 0 };

/** `heightAboveBase` του cut plane, clamped στο φυσικό ύψος `[0, height]`. */
function cutHeightAboveBase(cutPlaneMm: number, baseOffsetMm: number, heightMm: number): number {
  const h = cutPlaneMm - baseOffsetMm;
  if (h <= 0) return 0;
  return h > heightMm ? heightMm : h;
}

/** Plan-space μετατόπιση (mm) της κολώνας στο cut plane. Flat → μηδέν. */
export function columnCutPlaneShiftMm(params: ColumnParams, cutPlaneMm: number): PlanShift {
  if (!isColumnTilted(params)) return NO_SHIFT;
  const h = cutHeightAboveBase(cutPlaneMm, params.baseOffset ?? 0, Math.max(0, params.height));
  return columnTiltShearAt(params, h);
}

/** Plan-space μετατόπιση (mm) του τοίχου στο cut plane (⟂ run). Flat → μηδέν. */
export function wallCutPlaneShiftMm(params: WallParams, cutPlaneMm: number): PlanShift {
  if (!isWallTilted(params)) return NO_SHIFT;
  const h = cutHeightAboveBase(cutPlaneMm, params.baseOffset ?? 0, Math.max(0, params.height));
  return wallTiltShearAt(params, h);
}

/**
 * Plan-μετατόπιση (mm) → **canvas-world units** (× `s`), στο ίδιο space με τα
 * footprint vertices του renderer. `null` όταν η μετατόπιση είναι μηδέν (fast-path).
 * Ο renderer ζωγραφίζει τη βάση κανονικά και προσθέτει το μετατοπισμένο cut-plane
 * footprint + connecting lines (Revit slanted-column-in-plan).
 */
function shiftToCanvas(shiftMm: PlanShift, sceneUnits: ColumnParams['sceneUnits']): PlanShift | null {
  if (shiftMm.dx === 0 && shiftMm.dy === 0) return null;
  const s = mmToSceneUnits(sceneUnits ?? 'mm');
  return { dx: shiftMm.dx * s, dy: shiftMm.dy * s };
}

/** Canvas-world μετατόπιση κολώνας στο cut plane — `null` αν δεν γέρνει (fast-path). */
export function columnCutPlaneShiftCanvas(params: ColumnParams, cutPlaneMm: number): PlanShift | null {
  return shiftToCanvas(columnCutPlaneShiftMm(params, cutPlaneMm), params.sceneUnits);
}

/** Canvas-world μετατόπιση τοίχου στο cut plane — `null` αν δεν γέρνει (fast-path). */
export function wallCutPlaneShiftCanvas(params: WallParams, cutPlaneMm: number): PlanShift | null {
  return shiftToCanvas(wallCutPlaneShiftMm(params, cutPlaneMm), params.sceneUnits);
}
