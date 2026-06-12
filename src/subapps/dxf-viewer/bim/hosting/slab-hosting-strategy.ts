/**
 * Associative Grid Hosting — SLAB strategy (ADR-441, Slice GEN-SLAB).
 *
 * **Area hosting** (πρώτη μη-γραμμική/μη-σημειακή strategy): η πλάκα φατνώματος κρέμεται
 * σε **4 άξονες** (αριστερά/δεξιά X + κάτω/πάνω Y) μέσω των bindings start-x/end-x/
 * start-y/end-y. Όταν κουνηθεί οποιοσδήποτε από τους 4, το ορθογώνιο outline re-derives
 * μέσω του κοινού `deriveRectBaySlots` και η γεωμετρία ξαναβγαίνει από το SSoT
 * `computeSlabGeometry`.
 *
 * v1 follow-on-move: η πλάκα ακολουθεί ως **ορθογώνιο** (centerline-to-centerline). Το
 * clip στις παρειές δοκαριών + notch κολώνων εφαρμόζεται στη ΓΕΝΝΑ (`buildSlabBaysFromGuides`)·
 * το live re-clip κατά το drag χρειάζεται τα μετακινούμενα δοκάρια/κολώνες (δεν είναι
 * διαθέσιμα στο pure reconcile) → **DEFER** (regenerate για ακριβές re-clip). Επειδή ο
 * reconciler αγγίζει ΜΟΝΟ πλάκες δεμένες στον άξονα που σύρεται, οι υπόλοιπες κρατούν το
 * clip τους ανέπαφο.
 *
 * @see bim/hosting/hosting-strategy-types.ts
 * @see bim/hosting/derive-slots.ts — deriveRectBaySlots (shared SSoT)
 * @see bim/slabs/slab-from-grid.ts — buildSlabBaysFromGuides (generation-time clip/notch)
 */

import type { SlabGeometry, SlabParams } from '../types/slab-types';
import type { Point3D } from '../types/bim-base';
import { isSlabEntity } from '../../types/entities';
import { computeSlabGeometry } from '../geometry/slab-geometry';
import { validateSlabParams } from '../validators/slab-validator';
import { mmScaleFor } from '../../utils/scene-units';
import { hasGuideBindings } from './guide-binding-types';
import { deriveRectBaySlots, type Vec2 } from './derive-slots';
import type { HostingStrategy } from './hosting-strategy-types';

/** Ανοχή (scene units) για το «το outline είναι ήδη αυτό το ορθογώνιο» → no-op. */
const RECT_EQ_TOL = 1e-6;

/** Τα 4 corners ενός ορθογωνίου (CCW), διατηρώντας το z της πλάκας. */
function rectCorners(
  r: { x0: number; x1: number; y0: number; y1: number }, z: number,
): Point3D[] {
  return [
    { x: r.x0, y: r.y0, z },
    { x: r.x1, y: r.y0, z },
    { x: r.x1, y: r.y1, z },
    { x: r.x0, y: r.y1, z },
  ];
}

/** Είναι το τρέχον outline ήδη ακριβώς αυτές οι 4 κορυφές (→ καμία αλλαγή); */
function outlineEqualsRect(current: readonly Point3D[], rect: readonly Point3D[]): boolean {
  if (current.length !== rect.length) return false;
  for (let i = 0; i < rect.length; i++) {
    if (Math.abs(current[i].x - rect[i].x) > RECT_EQ_TOL) return false;
    if (Math.abs(current[i].y - rect[i].y) > RECT_EQ_TOL) return false;
  }
  return true;
}

export const slabHostingStrategy: HostingStrategy = {
  reconcile(entity, getOffset) {
    if (!isSlabEntity(entity) || !hasGuideBindings(entity)) return null;
    const p = entity.params;
    const scale = mmScaleFor(p);
    const rect = deriveRectBaySlots(entity.guideBindings, getOffset, scale);
    if (!rect) return null;
    const current = p.outline.vertices;
    const z = current[0]?.z ?? 0;
    const corners = rectCorners(rect, z);
    if (outlineEqualsRect(current, corners)) return null;
    const nextParams: SlabParams = { ...p, outline: { vertices: corners } };
    return {
      id: entity.id,
      type: 'slab',
      nextParams,
      nextGeometry: computeSlabGeometry(nextParams),
      nextValidation: validateSlabParams(nextParams).bimValidation,
    };
  },
  outline(nextGeometry) {
    const geometry = nextGeometry as SlabGeometry;
    const ring: Vec2[] = [];
    for (const v of geometry.polygon.vertices) ring.push({ x: v.x, y: v.y });
    return ring;
  },
};
