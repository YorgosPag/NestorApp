/**
 * ADR-458 (wall↔wall cross extension) — Wall-to-wall **cross-junction cutback** scene post-pass
 * (2Δ κάτοψη). Αδελφό του `dxf-scene-wall-cutback.ts` (wall↔column) — ίδιο pattern, ίδιο generic
 * SSoT (`member-column-cutback`), με **priority winner** αντί «η κολόνα πάντα νικάει».
 *
 * Για κάθε ζευγάρι τοίχων που **διασταυρώνονται γνήσια** (Χ, interior-interior — `wall-cross-cutback`),
 * ο υψηλότερης προτεραιότητας ΝΙΚΑΕΙ (μένει ακέραιος)· ο χαμηλότερος κόβεται στην κοινή περιοχή:
 * το DERIVED `geometry.displayFootprint` του loser γίνεται ο footprint ring μείον το footprint του
 * νικητή. Ο `WallRenderer` διαβάζει `displayFootprint ?? outer+inner ring` → ίδια γεωμετρία σε
 * bitmap ΚΑΙ interactive overlay (ένα entity, μία αλήθεια).
 *
 * Τρέχει **ΜΕΤΑ** το `applyWallColumnCutback2D`: αν ο loser έχει ήδη `displayFootprint` (κομμένος
 * από κολόνα), κόβουμε ΚΑΘΕ υπάρχον κομμάτι περαιτέρω με τους wall cutters (σύνθεση χωρίς
 * διπλότυπη boolean geometry). Zero-cost fast path: <2 τοίχοι ή καμία διασταύρωση → input αυτούσιο.
 *
 * @see bim/walls/wall-cross-cutback.ts — priority + cross detection (pure SSoT)
 * @see bim/geometry/member-column-cutback.ts — generic boolean-difference SSoT
 * @see hooks/canvas/dxf-scene-wall-cutback.ts — sibling (wall↔column)
 */

import type { DxfEntityUnion, DxfWall } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { Point3D } from '../../bim/types/bim-base';
import type { Pt2 } from '../../bim/geometry/shared/segment-polygon-coverage';
import { computeMemberCutbackOutline } from '../../bim/geometry/member-column-cutback';
import { buildWallFootprintRing } from '../../bim/geometry/wall-geometry';
import { computeWallCrossCutters, type WallCrossInput } from '../../bim/walls/wall-cross-cutback';

/**
 * Εφαρμόζει το wall-to-wall cross cutback. Επιστρέφει το ίδιο array (by-reference) όταν καμία
 * διασταύρωση δεν κόβει τοίχο· αλλιώς νέο array με τους κομμένους (losers) ανανεωμένους.
 */
export function applyWallWallCrossCutback2D(entities: DxfEntityUnion[]): DxfEntityUnion[] {
  const wallInputs: WallCrossInput[] = [];
  for (const e of entities) {
    if (e.type !== 'wall') continue;
    const wall = e as DxfWall;
    if (wall.kind !== 'straight') continue;
    const ring = buildWallFootprintRing(wall.geometry.outerEdge.points, wall.geometry.innerEdge.points);
    if (ring.length < 3) continue;
    wallInputs.push({ id: wall.id, params: wall.params, footprint: ring });
  }
  if (wallInputs.length < 2) return entities;

  const cutterMap = computeWallCrossCutters(wallInputs);
  if (cutterMap.size === 0) return entities;

  return entities.map((e) => {
    if (e.type !== 'wall') return e;
    const cutters = cutterMap.get(e.id);
    if (!cutters || cutters.length === 0) return e;
    const wall = e as DxfWall;

    // Base rings = ήδη-κομμένα κομμάτια από το column pass, αλλιώς ο raw footprint ring.
    const existing = wall.geometry.displayFootprint as Point3D[][] | undefined;
    const baseRings: Pt2[][] = existing
      ? existing.map((r) => r.map((p) => ({ x: p.x, y: p.y })))
      : [buildWallFootprintRing(wall.geometry.outerEdge.points, wall.geometry.innerEdge.points)];

    let changed = false;
    const out: Pt2[][] = [];
    for (const ring of baseRings) {
      if (ring.length < 3) { out.push(ring); continue; }
      const cut = computeMemberCutbackOutline(ring, cutters);
      if (cut === null) { out.push(ring); continue; }
      out.push(...cut);
      changed = true;
    }
    if (!changed) return e; // wall cutters δεν τεμαχίζουν → κράτα ό,τι έδωσε το column pass

    const displayFootprint: Point3D[][] = out.map((r) => r.map((p) => ({ x: p.x, y: p.y, z: 0 })));
    return { ...wall, geometry: { ...wall.geometry, displayFootprint } } as DxfEntityUnion;
  });
}
