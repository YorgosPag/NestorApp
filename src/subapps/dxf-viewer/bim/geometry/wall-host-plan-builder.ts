/**
 * Wall host-plan builder (ADR-401 Phase B) — SSoT.
 *
 * Παράγει τα `HostUndersidePlan` (κάτω-παρειά structural host προβαλλόμενη στον
 * άξονα του τοίχου + plan-overlap span) που καταναλώνει ο `resolveWallTopProfile`
 * (Phase A). Είναι ο ΕΝΑΣ τόπος που:
 *   1. υπολογίζει την κάτω-παρειά beam/slab (§2.3 formulas, απόλυτα mm), και
 *   2. προβάλλει το footprint του host στον άξονα του τοίχου → span [t0,t1] (0..1)
 *      μέσω **segment ∩ polygon** (t-intervals).
 *
 * Reuse (SSoT): `isPointInPolygon` (GeometryUtils), `computeBeamGeometry().outline`
 * (beam footprint SSoT). Beam/slab έχουν **οριζόντια** κάτω-παρειά → `z0mm===z1mm`·
 * κεκλιμένο host (στέγη/κεκλιμένο δοκάρι) = Phase E2.
 *
 * Convention μονάδων: το footprint του host ΚΑΙ ο άξονας του τοίχου πρέπει να
 * είναι στο **ίδιο** plan space (canvas units ή mm — ο builder είναι
 * unit-agnostic γιατί το `t` είναι αδιάστατο 0..1). Τα `z*mm` είναι απόλυτα mm
 * (ίδια σύμβαση με `beam.topElevation` / `slab.levelElevation`, ADR-369 §2).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-401-bim-wall-top-base-constraints-attach-to-structural.md §2.2, §2.3
 * @see wall-top-profile.ts — ο resolver που τρώει το output
 */

import type { BeamEntity } from '../types/beam-types';
import type { SlabEntity } from '../types/slab-types';
import { isPointInPolygon } from '../../utils/geometry/GeometryUtils';
import { computeBeamGeometry } from './beam-geometry';
import type { HostUndersidePlan, WallVerticalContext } from './wall-top-profile';

/** Ελάχιστο 2D σημείο (plan space). */
export interface Pt2 {
  readonly x: number;
  readonly y: number;
}

/**
 * Host έτοιμος για projection: footprint (ίδιες μονάδες με τον άξονα τοίχου) +
 * οριζόντια κάτω-παρειά σε **απόλυτα mm**. Κεκλιμένο host = Phase E2.
 */
export interface HostFootprintInput {
  readonly hostId: string;
  readonly hostType: HostUndersidePlan['hostType'];
  /** Plan footprint (closed polygon). */
  readonly footprint: readonly Pt2[];
  /** Κάτω-παρειά (absolute mm) — οριζόντια. */
  readonly undersideZmm: number;
}

/** Αριθμητικό όριο για μη-εκφυλισμένο t / non-parallel cross product. */
const T_EPS = 1e-9;

const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);

/**
 * t-τιμές (0..1, clamped) όπου ο άξονας a→b τέμνει ακμές του πολυγώνου. Standard
 * segment-segment intersection: άξονας `a+t·(b−a)`, ακμή `p+u·(q−p)`· κρατάμε
 * όσα έχουν 0≤u≤1 (η τομή πέφτει πάνω στην ακμή) και 0≤t≤1 (μέσα στον τοίχο).
 */
function axisPolygonCrossings(a: Pt2, b: Pt2, poly: readonly Pt2[]): number[] {
  const ts: number[] = [];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % n];
    const ex = q.x - p.x;
    const ey = q.y - p.y;
    const denom = dx * ey - dy * ex; // (b−a) × (q−p)
    if (Math.abs(denom) < T_EPS) continue; // parallel / collinear → αγνόησε
    const apx = p.x - a.x;
    const apy = p.y - a.y;
    const t = (apx * ey - apy * ex) / denom; // κατά μήκος άξονα
    const u = (apx * dy - apy * dx) / denom; // κατά μήκος ακμής
    if (t >= -T_EPS && t <= 1 + T_EPS && u >= -T_EPS && u <= 1 + T_EPS) {
      ts.push(clamp01(t));
    }
  }
  return ts;
}

/**
 * Τα [t0,t1] διαστήματα του άξονα a→b που βρίσκονται **μέσα** στο footprint.
 * Robust για convex + concave: σπάμε στο {0,1}+crossings, κρατάμε όσα sub-spans
 * έχουν midpoint inside (ray-cast SSoT), και merge-άρουμε τα συνεχόμενα.
 */
function coveredIntervals(a: Pt2, b: Pt2, poly: readonly Pt2[]): Array<[number, number]> {
  if (poly.length < 3) return [];
  const polyArr = poly.map((p) => ({ x: p.x, y: p.y }));
  const bps = new Set<number>([0, 1]);
  for (const t of axisPolygonCrossings(a, b, polyArr)) bps.add(t);
  const sorted = [...bps].sort((x, y) => x - y);
  const out: Array<[number, number]> = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const t0 = sorted[i];
    const t1 = sorted[i + 1];
    if (t1 - t0 < T_EPS) continue;
    const mid = (t0 + t1) / 2;
    const mx = a.x + mid * (b.x - a.x);
    const my = a.y + mid * (b.y - a.y);
    if (!isPointInPolygon({ x: mx, y: my }, polyArr)) continue;
    const prev = out[out.length - 1];
    if (prev && Math.abs(prev[1] - t0) < T_EPS) prev[1] = t1;
    else out.push([t0, t1]);
  }
  return out;
}

/**
 * Builder SSoT — προβάλλει κάθε host στον άξονα του τοίχου και επιστρέφει ένα
 * `HostUndersidePlan` ανά covered span. Host που δεν περνά πάνω από τον τοίχο →
 * μηδέν plans. Concave host που δίνει ≥2 spans → ένα plan ανά span (ίδιο hostId).
 */
export function buildHostUndersidePlans(
  wallStart: Pt2,
  wallEnd: Pt2,
  hosts: readonly HostFootprintInput[],
): HostUndersidePlan[] {
  const plans: HostUndersidePlan[] = [];
  for (const h of hosts) {
    if (h.footprint.length < 3) continue;
    for (const [t0, t1] of coveredIntervals(wallStart, wallEnd, h.footprint)) {
      plans.push({
        hostId: h.hostId,
        hostType: h.hostType,
        t0,
        t1,
        z0mm: h.undersideZmm,
        z1mm: h.undersideZmm,
      });
    }
  }
  return plans;
}

/**
 * `resolveHost` lookup (κατά `hostId`) για τον resolver. Όταν ένας host δίνει
 * ≥2 spans (concave footprint), επιστρέφεται το **μεγαλύτερο** span (dominant) —
 * το multi-span ανά host σε ένα `attachTopToIds` entry είναι Phase E refinement·
 * το συντριπτικό case (δοκάρι/κυρτή πλάκα) δίνει ένα span.
 */
export function makeResolveHost(
  wallStart: Pt2,
  wallEnd: Pt2,
  hosts: readonly HostFootprintInput[],
): (id: string) => HostUndersidePlan | null {
  const byId = new Map<string, HostUndersidePlan>();
  for (const plan of buildHostUndersidePlans(wallStart, wallEnd, hosts)) {
    const existing = byId.get(plan.hostId);
    if (!existing || plan.t1 - plan.t0 > existing.t1 - existing.t0) {
      byId.set(plan.hostId, plan);
    }
  }
  return (id: string) => byId.get(id) ?? null;
}

/**
 * Convenience: πλήρες `WallVerticalContext` με `resolveHost` δεμένο στους hosts.
 * `base` παρέχει τα floor/storey-ceiling πεδία (FFL κ.λπ.).
 */
export function makeWallTopContext(
  wallStart: Pt2,
  wallEnd: Pt2,
  hosts: readonly HostFootprintInput[],
  base: Omit<WallVerticalContext, 'resolveHost'>,
): WallVerticalContext {
  return { ...base, resolveHost: makeResolveHost(wallStart, wallEnd, hosts) };
}

// ─── Entity → HostFootprintInput adapters (§2.3 underside formulas) ───────────

/**
 * Beam → host input. Footprint = `computeBeamGeometry().outline` (SSoT 4-vertex
 * ορθογώνιο). Underside = `topElevation + zOffset − depth` (mirror του
 * `section-intersect.toBeamPlan` bottomY, εδώ σε mm).
 */
export function beamHostInput(beam: BeamEntity): HostFootprintInput {
  const footprint = computeBeamGeometry(beam.params).outline.vertices.map((v) => ({ x: v.x, y: v.y }));
  const undersideZmm = beam.params.topElevation + (beam.params.zOffset ?? 0) - beam.params.depth;
  return { hostId: beam.id, hostType: 'beam', footprint, undersideZmm };
}

/**
 * Slab → host input. Footprint = `params.outline`. Underside =
 * `levelElevation + heightOffsetFromLevel − thickness` (mirror του
 * `section-intersect.toSlabPlan` bottomY).
 */
export function slabHostInput(slab: SlabEntity): HostFootprintInput {
  const footprint = slab.params.outline.vertices.map((v) => ({ x: v.x, y: v.y }));
  const undersideZmm =
    slab.params.levelElevation + (slab.params.heightOffsetFromLevel ?? 0) - slab.params.thickness;
  return { hostId: slab.id, hostType: 'slab', footprint, undersideZmm };
}
