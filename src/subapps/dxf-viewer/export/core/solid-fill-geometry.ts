/**
 * ============================================================================
 * SOLID FILL GEOMETRY — footprint + height → 3D face list (pure SSoT)
 * ============================================================================
 *
 * ADR-505 §C (SOLID fill / poché). Ο Giorgio διάλεξε «βαμμένη επιφάνεια» =
 * κατακόρυφες όψεις γεμάτες σε 3Δ (DXF `3DFACE`), ΟΧΙ 2Δ plan poché (SOLID).
 *
 * Αυτό το module μετατρέπει ΕΝΑ footprint ring + ύψος ζώνης σε λίστα από planar
 * faces (κάθε face = 3-4 κορυφές με Z σε mm):
 *   - πλευρικές όψεις: ένα quad ανά ακμή του ring (base → top),
 *   - καπάκια (πάνω/κάτω): τριγωνοποίηση του ring μέσω
 *     `THREE.ShapeUtils.triangulateShape` (concave-safe — ΙΔΙΑ SSoT με
 *     `bim-3d/converters/column-piece-geometry.ts` / `wall-piece-geometry.ts`).
 *
 * Ο writer (`dxf-ascii-writer`) σειριοποιεί κάθε face ως `3DFACE` (μηδέν
 * triangulation στον writer → μένει pure serialization). Κορυφές: x/y σε scene
 * units (coordinate scale), zMm σε χιλιοστά (mmScale) — ΙΔΙΑ σύμβαση με τα 3Δ
 * rebar segments (group 30/31).
 *
 * @see ./overlay-dxf-collector.ts — ο consumer (σοβάς + δομικά σώματα fill)
 * @see ./dxf-ascii-writer.ts — emit3DFace
 */

import * as THREE from 'three';
import type { Point2D } from '../../rendering/types/Types';

/** Μία κορυφή 3D face: x/y σε scene units, z σε χιλιοστά (mm). */
export interface Fill3DCorner {
  readonly x: number;
  readonly y: number;
  readonly zMm: number;
}

/** Ένα planar face (3 ή 4 κορυφές) έτοιμο για DXF `3DFACE`. */
export type Fill3DFace = readonly Fill3DCorner[];

/** Drop a trailing point that duplicates the first (closed ring → open contour). */
function openRing(ring: readonly Point2D[]): Point2D[] {
  const pts = ring.slice();
  if (pts.length > 1) {
    const a = pts[0];
    const b = pts[pts.length - 1];
    if (Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9) pts.pop();
  }
  return pts;
}

/**
 * Faces ενός πρίσματος: footprint `ring` (scene units) εξωθημένο από `baseZMm`
 * κατά `heightMm`. Επιστρέφει κάτω καπάκι + (αν height>0) πάνω καπάκι + πλευρικές
 * όψεις. Flat fill (heightMm≤0) → μόνο ένα γεμάτο καπάκι στο `baseZMm` (2Δ poché
 * fallback). Κενό όταν το ring έχει <3 κορυφές.
 */
export function buildPrismFaces(
  ring: readonly Point2D[],
  baseZMm: number,
  heightMm: number,
): Fill3DFace[] {
  const pts = openRing(ring);
  const n = pts.length;
  if (n < 3) return [];

  const topZ = baseZMm + Math.max(0, heightMm);
  const faces: Fill3DFace[] = [];

  // ── Καπάκια (concave-safe triangulation, SSoT THREE.ShapeUtils). ──
  const contour = pts.map((p) => new THREE.Vector2(p.x, p.y));
  const tris = THREE.ShapeUtils.triangulateShape(contour, []);
  const capAt = (z: number, reverse: boolean): void => {
    for (const [a, b, c] of tris) {
      const order = reverse ? [a, c, b] : [a, b, c];
      faces.push(order.map((i) => ({ x: pts[i].x, y: pts[i].y, zMm: z })));
    }
  };
  capAt(baseZMm, true); // κάτω καπάκι (κοιτά κάτω)

  if (heightMm > 0) {
    capAt(topZ, false); // πάνω καπάκι (κοιτά πάνω)

    // ── Πλευρικές όψεις: ένα quad ανά ακμή i→j (j = (i+1) mod n). ──
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      faces.push([
        { x: pts[i].x, y: pts[i].y, zMm: baseZMm },
        { x: pts[j].x, y: pts[j].y, zMm: baseZMm },
        { x: pts[j].x, y: pts[j].y, zMm: topZ },
        { x: pts[i].x, y: pts[i].y, zMm: topZ },
      ]);
    }
  }

  return faces;
}
