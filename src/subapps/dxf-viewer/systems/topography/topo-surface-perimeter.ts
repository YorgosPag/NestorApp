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
 * Καμία create-logic εδώ: η αλυσοποίηση είναι το κοινό `chainUndirectedEdges` SSoT
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
 * @see ./graph-chain.ts — chainUndirectedEdges (SSoT walk)
 * @see ./topo-local-origin.ts — localToWorld (SSoT origin re-projection)
 */

import type { Point2D } from '../../rendering/types/Types';
import type { TinSurface } from './topo-types';
import { localToWorld } from './topo-local-origin';
import { chainUndirectedEdges } from './graph-chain';

/** Undirected edge key (order-independent), so an edge counts once whichever triangle names it. */
function edgeKey(a: number, b: number): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

/** The three undirected edges of a CCW triangle. */
function triangleEdges(tri: readonly [number, number, number]): readonly (readonly [number, number])[] {
  const [i, j, k] = tri;
  return [[i, j], [j, k], [k, i]];
}

/**
 * The perimeter ring(s) of a TIN in **WORLD canonical mm** — the boundary edges chained into
 * closed loop(s). An empty / untriangulable surface (no triangles) yields `[]`. A surface with
 * interior holes yields multiple rings (outer + hole loops), each a valid polygon (≥ 3 vertices).
 */
export function topoSurfacePerimeter(surface: TinSurface): Point2D[][] {
  const { triangles, positions, origin } = surface;
  if (triangles.length === 0) return [];

  // Pass 1 — how many triangles claim each undirected edge.
  const claimCount = new Map<string, number>();
  for (const tri of triangles) {
    for (const [a, b] of triangleEdges(tri)) {
      const key = edgeKey(a, b);
      claimCount.set(key, (claimCount.get(key) ?? 0) + 1);
    }
  }

  // Pass 2 — collect the boundary edges (claimed by exactly one triangle).
  const boundary: [number, number][] = [];
  for (const tri of triangles) {
    for (const [a, b] of triangleEdges(tri)) {
      if (claimCount.get(edgeKey(a, b)) === 1) boundary.push([a, b]);
    }
  }
  if (boundary.length === 0) return [];

  // Chain into ordered ring(s) (shared walk), drop the repeated closing node, re-project LOCAL→WORLD.
  return chainUndirectedEdges(boundary)
    .map(({ nodes, closed }) => {
      const indices = closed ? nodes.slice(0, -1) : nodes;
      return indices.map((idx) => {
        const [x, y] = positions[idx];
        return localToWorld({ x, y }, origin);
      });
    })
    .filter((ring) => ring.length >= 3);
}
