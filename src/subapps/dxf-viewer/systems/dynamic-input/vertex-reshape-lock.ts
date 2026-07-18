/**
 * ADR-513 §grip-parity — DISPLACEMENT (Model A) length/angle lock for an ARC/POLYLINE vertex or
 * straight edge-midpoint click-move-click reshape (the sibling of the LINE-endpoint
 * `resolveLineEndpointLockedDelta`, but with displacement — not «set line length» — semantics).
 *
 * Giorgio 2026-07-18: πιάνεις γωνία ορθογωνίου, ORTHO κλειδώνει οριζόντια, πληκτρολογείς 500 → η
 * κορυφή μετακινείται ΚΑΤΑ 500 προς εκείνη την κατεύθυνση (τραπέζιο). Δηλαδή:
 *   · κατεύθυνση = ORTHO/POLAR-locked κέρσορας ΣΧΕΤΙΚΑ με τη grabbed λαβή (`resolveOrthoPolarStep`),
 *   · μέγεθος    = η πληκτρολογούμενη «Μήκος» τιμή (`applyLengthAngleLock`, rescale κρατώντας την κατεύθυνση).
 * `anchorPos` = η ΘΕΣΗ της grabbed λαβής (κορυφή ή edge midpoint) → το delta μετακινεί ΜΙΑ κορυφή
 * (γωνία → τραπέζιο) ή, για edge grip, ΚΑΙ τις δύο ακραίες κορυφές (όλη η πλευρά) μέσω του
 * `edgeVertexIndices` path στο `applyClassicEntityPreview` / `stretchPolyline` — μία delta, entity-agnostic.
 *
 * Fixes the ORTHO-composition gap: unlike the line resolver (free `fixed→cursor` direction), εδώ το
 * ORTHO ΟΡΙΖΕΙ την κατεύθυνση πριν το typed length την ξανα-κλιμακώσει — ίδιο pattern με τη ΣΧΕΔΙΑΣΗ
 * (`drawing-hover-handler`: `resolveOrthoPolarStep` → `applyLengthAngleLock`).
 *
 * Returns `null` (→ caller keeps the raw ORTHO-constrained delta) when there is no active lock or the
 * grip is not an eligible vertex reshape, so wiring it into ghost + commit is a no-op otherwise (zero
 * regression). Called by BOTH seams (ghost + `grip-mouseup-handler`) so preview ≡ commit.
 *
 * @see hooks/grips/vertex-reshape-hotgrip.ts — `isVertexReshapeGrip` (the ONE eligibility SSoT)
 * @see ./length-angle-lock.ts — `applyLengthAngleLock` (typed-length rescale, shared with drawing)
 * @see ../../hooks/drawing/drawing-handler-utils.ts — `resolveOrthoPolarStep` (ORTHO→POLAR direction SSoT)
 */

import type { Point2D } from '../../rendering/types/Types';
import { isVertexReshapeGrip } from '../../hooks/grips/vertex-reshape-hotgrip';
// N.18 (2026-07-18) — τα ORTHO/POLAR→typed-length μαθηματικά ζουν ΜΙΑ φορά στον κοινό πυρήνα·
// εδώ μένει ΜΟΝΟ το «ποια λαβή είναι επιλέξιμη». Ο αδελφός καταναλωτής είναι το
// `move-displacement-lock.ts` (λαβή μετακίνησης) — γραμμένοι ως δίδυμα θα ήταν structural clones.
import { resolveDisplacementLockedDelta } from './displacement-lock-core';

/** Minimal grip view the resolver needs — supplied by the ghost (`dp`) and the commit (`grip`).
 *  The caller resolves `polylineKind` via `gripKindOf(x, 'polyline')` + `isEdge` from `edgeVertexIndices`. */
export interface VertexReshapeGripLike {
  readonly gripIndex?: number;
  readonly movesEntity?: boolean;
  readonly polylineKind: string | null;
  readonly isEdge: boolean;
}

/**
 * The displacement lock delta for an eligible arc/polyline vertex-or-edge reshape, relative to the
 * grabbed grip's ORIGINAL position (`anchorPos` = `grip.position`). `cursorWorld` = live cursor
 * world. `null` when no lock is active or the grip is not an eligible reshape.
 */
export function resolveVertexReshapeLockedDelta(
  entity: unknown,
  grip: VertexReshapeGripLike,
  anchorPos: Readonly<Point2D>,
  cursorWorld: Readonly<Point2D>,
): Point2D | null {
  const eligible = isVertexReshapeGrip({
    entityType: (entity as { type?: string } | null | undefined)?.type,
    gripIndex: grip.gripIndex,
    movesEntity: grip.movesEntity,
    polylineKind: grip.polylineKind,
    isEdge: grip.isEdge,
  });
  if (!eligible) return null;

  // ORTHO/POLAR determine the DIRECTION from the grabbed grip; typed «Μήκος» rescales the magnitude.
  return resolveDisplacementLockedDelta(anchorPos, cursorWorld);
}
