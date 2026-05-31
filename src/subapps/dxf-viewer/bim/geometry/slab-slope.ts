/**
 * Slab slope-plane SSoT (ADR-401 Phase E2 / ADR-369 §9 Q7).
 *
 * Καθιερώνει την **κανονική ερμηνεία** του `SlabSlope` ως ένα single-plane
 * tilt: επιστρέφει το απόλυτο Z (mm) της **επάνω** ή **κάτω** παρειάς μιας
 * πλάκας/στέγης σε οποιοδήποτε plan-point. Πρώτος καταναλωτής = ο
 * `slabHostInput` (wall-host-plan-builder) ώστε ένας τοίχος με
 * `topBinding='attached'` να ακολουθεί την **κεκλιμένη** κάτω-παρειά μιας
 * tilted στέγης (z0mm ≠ z1mm στο `HostUndersidePlan`).
 *
 * Σύμβαση κλίσης (ADR-369 §9 Q7):
 *   - `direction` — μοίρες CCW from +X (0=East, 90=North): η φορά «ανηφόρας».
 *   - `angle` — ποσοστό (%) → mm ανύψωσης ανά mm οριζόντιας απόστασης κατά
 *     μήκος της `direction` (2% = drainage standard).
 *   - `pivotEdge` — η γραμμή/σημείο που μένει στη **nominal** στάθμη
 *     (`levelElevation + heightOffsetFromLevel`)· default `'center'` (κέντρο
 *     AABB). N/S/E/W = μέσο της αντίστοιχης ακμής του AABB.
 *
 * Μονάδες: το `pt` ΠΡΕΠΕΙ να είναι στο **ίδιο plan space (mm)** με το
 * `params.outline` (canonical world-mm, slab-types) — όπως ακριβώς ο scalar
 * `slabHostInput`. Το αποτέλεσμα είναι απόλυτο mm (ίδια σύμβαση με
 * `slab.levelElevation`, ADR-369 §2).
 *
 * `geometryType !== 'tilted'` ή απών `slope` → slope offset = 0 (flat
 * fast-path, byte-for-byte ίδιο με τον προηγούμενο scalar υπολογισμό).
 *
 * @see wall-host-plan-builder.ts — `slabHostInput` (πρώτος consumer)
 * @see docs/centralized-systems/reference/adrs/ADR-401-bim-wall-top-base-constraints-attach-to-structural.md §2.3, Phase E2
 * @see docs/centralized-systems/reference/adrs/ADR-369-bim-elevation-convention-revit-alignment.md §9 Q7
 */

import type { SlabParams } from '../types/slab-types';

/** Ελάχιστο 2D plan-point (mm, ίδιο space με `SlabParams.outline`). */
export interface SlabPlanPoint {
  readonly x: number;
  readonly y: number;
}

const DEG_TO_RAD = Math.PI / 180;

/** AABB του outline (mm). Outline εγγυημένα ≥3 κορυφές (schema). */
function outlineAabb(params: SlabParams): { minX: number; maxX: number; minY: number; maxY: number } {
  const verts = params.outline.vertices;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const v of verts) {
    if (v.x < minX) minX = v.x;
    if (v.x > maxX) maxX = v.x;
    if (v.y < minY) minY = v.y;
    if (v.y > maxY) maxY = v.y;
  }
  return { minX, maxX, minY, maxY };
}

/**
 * Το pivot-point (mm) που μένει στη nominal στάθμη. `'center'` = κέντρο AABB·
 * N/S/E/W = μέσο της αντίστοιχης ακμής (N=max Y, S=min Y, E=max X, W=min X).
 */
function pivotPoint(params: SlabParams): SlabPlanPoint {
  const { minX, maxX, minY, maxY } = outlineAabb(params);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  switch (params.slope?.pivotEdge) {
    case 'N':
      return { x: cx, y: maxY };
    case 'S':
      return { x: cx, y: minY };
    case 'E':
      return { x: maxX, y: cy };
    case 'W':
      return { x: minX, y: cy };
    case 'center':
    default:
      return { x: cx, y: cy };
  }
}

/**
 * Slope offset (mm) στο `pt` σχετικά με το pivot: signed οριζόντια απόσταση
 * κατά μήκος της `direction` × (angle/100). Flat (μη-tilted) → 0.
 */
export function slabSlopeOffsetZmm(params: SlabParams, pt: SlabPlanPoint): number {
  const slope = params.slope;
  if (params.geometryType !== 'tilted' || !slope) return 0;
  const rad = slope.direction * DEG_TO_RAD;
  const ux = Math.cos(rad);
  const uy = Math.sin(rad);
  const pivot = pivotPoint(params);
  const d = (pt.x - pivot.x) * ux + (pt.y - pivot.y) * uy; // signed κατά την ανηφόρα
  return d * (slope.angle / 100);
}

/**
 * Απόλυτο Z (mm) της **επάνω** παρειάς της πλάκας στο `pt`.
 * = `levelElevation + heightOffsetFromLevel + slopeOffset(pt)`.
 */
export function slabTopZmmAt(params: SlabParams, pt: SlabPlanPoint): number {
  return params.levelElevation + (params.heightOffsetFromLevel ?? 0) + slabSlopeOffsetZmm(params, pt);
}

/**
 * Απόλυτο Z (mm) της **κάτω** παρειάς της πλάκας στο `pt` (σταθερό πάχος → η
 * κάτω παρειά είναι παράλληλο κεκλιμένο επίπεδο). = `topZ(pt) − thickness`.
 * Αυτό καταναλώνει ο `slabHostInput` για το `HostUndersidePlan.z*mm`.
 */
export function slabUndersideZmmAt(params: SlabParams, pt: SlabPlanPoint): number {
  return slabTopZmmAt(params, pt) - params.thickness;
}
