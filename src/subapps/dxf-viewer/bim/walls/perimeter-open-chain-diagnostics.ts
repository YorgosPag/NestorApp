/**
 * ADR-419 Layer 5 — open-loop diagnostics (SSoT split from `perimeter-from-faces.ts`, N.7.1).
 *
 * Όταν οι γραμμές μιας παρειάς ΔΕΝ κλείνουν βρόχο, εντόπισε ΠΟΥ είναι το κενό:
 *   - `findOpenChainLineIdsNear` → ids των γραμμών με ελεύθερο άκρο (Revit «these lines
 *     don't connect») για highlight μέσω `dxf.highlightByIds`.
 *   - `findOpenChainEndpointsNear` → τα ΣΗΜΕΙΑ των ελεύθερων άκρων (AutoCAD `BOUNDARY`
 *     red-circles) ώστε το overlay να τα σημαδέψει.
 *
 * Κοινός γράφος segments (`buildSegmentGraph`) — ΕΝΑ SSoT, reuse `extractLineSegments`
 * (wall-in-region) + `dist` (perimeter-polygon-math). Καμία αναπαραγωγή geometry math.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-419-floor-finish-per-room.md §Layer 5
 * @see ./perimeter-from-faces.ts (orchestrator — re-exports these για backward-compat)
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import { extractLineSegments, type RegionLineSeg } from './wall-in-region';
import { dist } from './perimeter-polygon-math';
import { projectPointTo2D } from '../geometry/shared/polygon-utils';

/** Γράφος κόμβων/γειτνίασης από segments (συγχώνευση άκρων εντός tol). */
export function buildSegmentGraph(
  segs: readonly RegionLineSeg[],
  tol: number,
): { nodes: Point2D[]; adj: number[][] } {
  const nodes: Point2D[] = [];
  const adj: number[][] = [];
  const indexOf = (p: Point2D): number => {
    for (let i = 0; i < nodes.length; i++) {
      if (dist(nodes[i], p) <= tol) return i;
    }
    nodes.push(projectPointTo2D(p));
    adj.push([]);
    return nodes.length - 1;
  };
  for (const s of segs) {
    const a = indexOf(s.start);
    const b = indexOf(s.end);
    if (a === b) continue;
    if (!adj[a].includes(b)) adj[a].push(b);
    if (!adj[b].includes(a)) adj[b].push(a);
  }
  return { nodes, adj };
}

/**
 * Layer 5 — open-loop diagnostics: ids των γραμμών κοντά στο `point` που έχουν
 * **ανοιχτό άκρο** (κόμβος βαθμού 1 στον γράφο των segments) — αυτές «δεν
 * ενώνονται» (Revit «these lines don't connect»). Reuse `extractLineSegments` +
 * `buildSegmentGraph`. Επιστρέφει deduped ids για highlight μέσω `dxf.highlightByIds`.
 */
export function findOpenChainLineIdsNear(
  point: Readonly<Point2D>,
  entities: readonly Entity[],
  tol: number,
): string[] {
  const segs = extractLineSegments(entities);
  if (segs.length === 0) return [];
  const { nodes, adj } = buildSegmentGraph(segs, tol);
  // Ανοιχτά άκρα = κόμβοι βαθμού 1· κρατάμε όσα είναι κοντά στο pick (εντός 50×tol).
  const reach = Math.max(tol * 50, tol);
  const openNodes = new Set<number>();
  for (let i = 0; i < nodes.length; i++) {
    if (adj[i].length === 1 && dist(nodes[i], point as Point2D) <= reach) openNodes.add(i);
  }
  if (openNodes.size === 0) return [];
  const ids = new Set<string>();
  for (const s of segs) {
    if (!s.id) continue;
    const a = nodes.findIndex((n) => dist(n, s.start) <= tol);
    const b = nodes.findIndex((n) => dist(n, s.end) <= tol);
    if (openNodes.has(a) || openNodes.has(b)) ids.add(s.id);
  }
  return [...ids];
}

/**
 * ADR-419 Layer 5b — τα ΣΗΜΕΙΑ (world units) των ανοιχτών άκρων κοντά στο pick.
 *
 * AutoCAD `BOUNDARY` red-circles feedback: όταν οι γραμμές δεν κλείνουν βρόχο, δείξε
 * ΠΟΥ είναι το κενό — κόκκινος κύκλος σε κάθε ελεύθερο άκρο (κόμβος βαθμού 1). Ίδιος
 * graph με το `findOpenChainLineIdsNear` (SSoT `buildSegmentGraph`), αλλά επιστρέφει
 * τα σημεία των κόμβων αντί για τα ids των γραμμών, ώστε το overlay να τα σημαδέψει.
 */
export function findOpenChainEndpointsNear(
  point: Readonly<Point2D>,
  entities: readonly Entity[],
  tol: number,
): Point2D[] {
  const segs = extractLineSegments(entities);
  if (segs.length === 0) return [];
  const { nodes, adj } = buildSegmentGraph(segs, tol);
  const reach = Math.max(tol * 50, tol);
  const open: Point2D[] = [];
  for (let i = 0; i < nodes.length; i++) {
    if (adj[i].length === 1 && dist(nodes[i], point as Point2D) <= reach) {
      open.push(projectPointTo2D(nodes[i]));
    }
  }
  return open;
}
