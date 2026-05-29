/**
 * ADR-396 Phase P4 — Envelope (ETICS) render plan (PURE SSoT).
 *
 * Καθαρός υπολογισμός του render plan ενός `EnvelopeChain` — μηδέν canvas/React/
 * transform εξάρτηση (testable χωρίς jsdom). Ο canvas drawer ζει στο
 * `EnvelopeRenderer.ts` (consumes αυτό το plan).
 *
 * Hatch SSoT: reuse `computeWallHatchPlan` (`bim/walls/wall-hatch-patterns.ts`) —
 * ΚΑΜΙΑ διπλασιασμένη hatch math.
 *
 * ΜΟΝΑΔΕΣ: τα vertices είναι σε **canvas units** (όπως βγαίνουν από το
 * `computeEnvelopePerimeter`). worldToScreen γίνεται στον renderer.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-396-bim-external-thermal-envelope-etics.md §3, §5, §7 (P4)
 */

import type { Point3D, BoundingBox3D } from '../types/bim-base';
import type { EnvelopeChain } from '../geometry/envelope-perimeter';
import type { EnvelopeMaterialId } from '../types/thermal-envelope-types';
import {
  computeWallHatchPlan,
  resolveWallMaterialKey,
  type WallMaterialKey,
  type HatchPlan,
} from '../walls/wall-hatch-patterns';

export interface EnvelopeRenderPlan {
  /** Κλειστό δαχτυλίδι πάχους μόνωσης (outer forward + exterior face reversed). */
  readonly bandRing: readonly Point3D[];
  /** Η εξωτ. όψη της μόνωσης (συνεχής offset polyline). */
  readonly outerLoop: readonly Point3D[];
  readonly outerClosed: boolean;
  /** Hatch lines (canvas units) από το `computeWallHatchPlan`. */
  readonly hatch: HatchPlan;
}

/**
 * Map insulation material → υπάρχον `WallMaterialKey` (hatch SSoT reuse). Η ETICS
 * μόνωση ζωγραφίζεται με διαγώνια διαγράμμιση (`gypsum` single-diagonal, ελαφριά,
 * ξεχωρίζει από RC dot-grid & masonry brick). Dedicated insulation-batting pattern
 * = future polish αν το ζητήσει ο Giorgio (P4 reuse, ΟΧΙ νέο hatch family).
 */
export function resolveEnvelopeHatchKey(_materialId: EnvelopeMaterialId): WallMaterialKey {
  return resolveWallMaterialKey('gypsum');
}

function bboxOf(points: readonly Point3D[]): BoundingBox3D {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { min: { x: minX, y: minY, z: 0 }, max: { x: maxX, y: maxY, z: 0 } };
}

/**
 * Χτίζει το render plan ενός chain. Επιστρέφει null αν το chain δεν έχει αρκετές
 * κορυφές για band (π.χ. degenerate / πάχος 0 → outer === face).
 */
export function buildEnvelopeRenderPlan(
  chain: EnvelopeChain,
  materialId: EnvelopeMaterialId,
): EnvelopeRenderPlan | null {
  const outer = chain.insulationOuterLoop.points;
  const inner = chain.exteriorFaceLoop.points;
  if (outer.length < 2 || inner.length < 2) return null;

  const bandRing: Point3D[] = [...outer, ...[...inner].reverse()];
  const hatch = computeWallHatchPlan(bboxOf(bandRing), resolveEnvelopeHatchKey(materialId));
  return { bandRing, outerLoop: outer, outerClosed: chain.closed, hatch };
}
