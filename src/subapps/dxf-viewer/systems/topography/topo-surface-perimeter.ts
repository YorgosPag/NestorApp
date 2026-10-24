/**
 * ADR-662 Φάση 2β (Δρόμος Γ) — TIN perimeter (footprint) SSoT.
 *
 * ΕΝΑ pure helper «TinSurface → περίγραμμα(τα)» — το geometric core του
 * `TopoSurfaceEntity.footprint`. Big-player μοντέλο (Civil 3D «Surface Border» /
 * Revit Toposolid boundary): το ορατό όριο μιας επιφάνειας είναι οι **boundary
 * edges** της τριγωνοποίησης — οι ακμές που ανήκουν σε **ΑΚΡΙΒΩΣ 1 triangle** (μια
 * εσωτερική ακμή τη μοιράζονται δύο τρίγωνα· μια περιμετρική μόνο ένα). Οι boundary
 * edges αλυσοποιούνται σε κλειστό/-ά ring(s) και επαναπροβάλλονται LOCAL→WORLD.
 *
 * Καμία create-logic εδώ: οι ακμές συνόρου + η αλυσοποίηση είναι το κοινό `tinBoundaryLoops` SSoT
 * (ίδιος walk με τις ισοϋψείς) και η LOCAL→WORLD το κοινό `localToWorld` SSoT (ίδιο
 * origin-offset μονοπάτι με το `contour-chainer`). Έτσι ΚΑΙ ο producer hook ΚΑΙ το
 * `regenerate-topo` καλούν το ΙΔΙΟ footprint — μηδέν token-clone (N.18).
 *
 * ⚠️ Datum (ADR-635/650 M10): τα `positions` είναι LOCAL· χωρίς το `origin` offset το
 * footprint θα καθόταν στο (0,0) ενώ η geo-referenced επιφάνεια ζει αλλού → hit-test
 * «σε λάθος σημείο». Το `localToWorld` κλείνει αυτό το κενό (WORLD canonical mm).
 *
 * Pure — μηδέν store side effects (unit-testable). Η geo-reference προβολή προς το
 * display frame γίνεται από τον caller (mirror `projectContoursToLocal`), όχι εδώ.
 *
 * @see ./contour-chainer.ts — το δίδυμο μονοπάτι (segments → WORLD contour lines)
 * @see @/lib/terrain/tin-boundary-loops — boundary edges + chained rings (SSoT core)
 * @see ./topo-local-origin.ts — localToWorld (SSoT origin re-projection)
 */

import type { Point2D } from '../../rendering/types/Types';
import type { TinSurface } from './topo-types';
import { localToWorld } from './topo-local-origin';
import { tinBoundaryLoops } from '@/lib/terrain/tin-boundary-loops';

/**
 * The perimeter ring(s) of a TIN in **WORLD canonical mm** — the boundary edges chained into
 * closed loop(s). An empty / untriangulable surface (no triangles) yields `[]`. A surface with
 * interior holes yields multiple rings (outer + hole loops), each a valid polygon (≥ 3 vertices).
 *
 * The boundary-edge core lives in `@/lib/terrain/tin-boundary-loops` (ADR-920 Β4.8 — the plot
 * listing map asks the same question outside the subapp, CHECK 3.62); this keeps only LOCAL→WORLD.
 */
export function topoSurfacePerimeter(surface: TinSurface): Point2D[][] {
  const { triangles, positions, origin } = surface;
  return tinBoundaryLoops(triangles).map((ring) =>
    ring.map((idx) => {
      const [x, y] = positions[idx];
      return localToWorld({ x, y }, origin);
    }),
  );
}
