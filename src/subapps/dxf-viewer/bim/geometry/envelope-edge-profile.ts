/**
 * Envelope variable-edge resolver CORE (ADR-401) — SSoT κοινός πυρήνας για τα
 * δίδυμα `envelope-wall-top` (κορυφή, Phase B3b) και `envelope-wall-base` (βάση,
 * (γ) base-attach).
 *
 * Τα δύο resolvers ήταν byte-για-byte δίδυμα: ίδιο mapping perimeter-edge →
 * wall-profile (προβολή face-endpoints στον άξονα → `tA,tB`, σπάσιμο στα profile
 * breakpoints, interior-biased eval ανά sub-segment ώστε το σκαλοπάτι/ασυνέχεια
 * να αναπαρίσταται σωστά), ίδιο segment-walking, ίδιος area accumulator. **Η μόνη
 * διαφορά** είναι η z-normalization: το top κάνει `Math.max(0, …)` (δεν κατεβαίνει
 * κάτω από το πάτωμα), η βάση **δεν** clamp-άρει (μπορεί <0, θεμέλιο). Αυτό
 * περνιέται ως `ZToMeters` callback → μηδέν παράλληλα twins (ADR-583 / CHECK 3.28).
 *
 * ΜΟΝΑΔΕΣ: face/axis στο ΙΔΙΟ plan space (canvas units)· `t`/`s` αδιάστατα· `z*M`
 * = μέτρα πάνω από τη βάση ορόφου = `(zmm − floorElevationMm)·0.001`.
 *
 * Pure SSoT — μηδέν globals / React / Firestore.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-401-bim-wall-top-base-constraints-attach-to-structural.md
 * @see ./envelope-wall-top (top/lower-envelope wrapper — clamp ≥0)
 * @see ./envelope-wall-base (base/upper-envelope wrapper — χωρίς clamp)
 */

import type { Point3D } from '../types/bim-base';
import type { EnvelopeChain } from './envelope-perimeter';
import { envelopeFaceEdges } from './envelope-opening-cuts';
import { clamp01 } from '../../rendering/entities/shared/geometry-utils';

const EPS = 1e-9;

/** Ελάχιστο 2D σημείο plan space (canvas units). */
export interface AxisPoint {
  readonly x: number;
  readonly y: number;
}

/** Κοινό σχήμα profile segment (top/base): γραμμικά `z0mm → z1mm` στο `[t0,t1]`. */
export interface ProfileSegment {
  readonly t0: number;
  readonly t1: number;
  readonly z0mm: number;
  readonly z1mm: number;
}

/** Κοινό profile: ordered segments που καλύπτουν `[0,1]`. */
export interface EdgeProfile<S extends ProfileSegment = ProfileSegment> {
  readonly segments: readonly S[];
}

/** Άξονας + προφίλ ενός `attached` τοίχου (ίδιο plan space με το chain). */
export interface WallProfileRef<S extends ProfileSegment = ProfileSegment> {
  readonly start: AxisPoint;
  readonly end: AxisPoint;
  readonly profile: EdgeProfile<S>;
}

/**
 * Ένα sub-segment μιας ακμής κελύφους: από edge-local `s0` έως `s1` (0 = `face[a]`,
 * 1 = `face[b]`), z γραμμικά `z0M → z1M` (ΜΕΤΡΑ πάνω από τη βάση ορόφου· για βάση
 * μπορεί `< 0`).
 */
export interface EnvelopeEdgeSeg {
  readonly s0: number;
  readonly s1: number;
  readonly z0M: number;
  readonly z1M: number;
}

/** Μεταβλητό προφίλ μιας ακμής κελύφους — ordered sub-segments που καλύπτουν `[0,1]`. */
export interface EnvelopeEdge {
  readonly segments: readonly EnvelopeEdgeSeg[];
}

/** mm → μέτρα πάνω από τη βάση ορόφου (top clamp-άρει ≥0· base όχι). */
export type ZToMeters = (zmm: number, floorElevationMm: number) => number;

/** Παράμετρος προβολής σημείου `p` στην ευθεία του άξονα `start→end` (αδιάστατη). */
export function projectTOnAxis(start: AxisPoint, end: AxisPoint, p: AxisPoint): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < EPS) return 0;
  return ((p.x - start.x) * dx + (p.y - start.y) * dy) / len2;
}

/** Όλα τα t-boundaries του προφίλ (segment endpoints), αύξοντα, deduped. */
function breakpointTs(profile: EdgeProfile): number[] {
  const set = new Set<number>();
  for (const s of profile.segments) {
    set.add(s.t0);
    set.add(s.t1);
  }
  return [...set].sort((a, b) => a - b);
}

/** Το profile segment που καλύπτει το `t` (πρώτο που ταιριάζει· fallback τελευταίο). */
function segmentAt<S extends ProfileSegment>(profile: EdgeProfile<S>, t: number): S {
  const segs = profile.segments;
  for (const s of segs) {
    if (t >= s.t0 - EPS && t <= s.t1 + EPS) return s;
  }
  return segs[segs.length - 1];
}

/** z (mm) ενός segment στο `t` (γραμμικά z0→z1, clamped στο span). */
function zOfSegment(seg: ProfileSegment, t: number): number {
  const span = seg.t1 - seg.t0;
  if (span < EPS) return seg.z0mm;
  const tc = t < seg.t0 ? seg.t0 : t > seg.t1 ? seg.t1 : t;
  return seg.z0mm + ((seg.z1mm - seg.z0mm) * (tc - seg.t0)) / span;
}

/**
 * Μεταβλητό προφίλ (top ή base) μιας ακμής: προβάλλει τα δύο face-endpoints στον
 * άξονα, σπάει στα profile breakpoints, βγάζει ανεξάρτητα sub-segments (interior-
 * biased eval μέσω του segment που καλύπτει το midpoint → σκαλοπάτι/ασυνέχεια δεν
 * «λοξεύει» στο breakpoint). Το `zMap` κάνει mm→μέτρα (top clamp≥0 / base χωρίς).
 */
export function resolveEdgeProfile(
  fa: Point3D,
  fb: Point3D,
  ref: WallProfileRef,
  floorElevationMm: number,
  zMap: ZToMeters,
): EnvelopeEdge {
  const tA = projectTOnAxis(ref.start, ref.end, fa);
  const tB = projectTOnAxis(ref.start, ref.end, fb);
  const profile = ref.profile;

  // Degenerate (ακμή κάθετη στον άξονα → tA≈tB): επίπεδο προφίλ στο tA.
  if (Math.abs(tB - tA) < EPS) {
    const z = zMap(zOfSegment(segmentAt(profile, clamp01(tA)), clamp01(tA)), floorElevationMm);
    return { segments: [{ s0: 0, s1: 1, z0M: z, z1M: z }] };
  }

  const lo = Math.min(tA, tB);
  const hi = Math.max(tA, tB);
  const sSet = new Set<number>([0, 1]);
  for (const tb of breakpointTs(profile)) {
    if (tb > lo + EPS && tb < hi - EPS) sSet.add(clamp01((tb - tA) / (tB - tA)));
  }
  const splits = [...sSet].sort((a, b) => a - b);

  const segments: EnvelopeEdgeSeg[] = [];
  for (let k = 0; k < splits.length - 1; k++) {
    const s0 = splits[k];
    const s1 = splits[k + 1];
    if (s1 - s0 < EPS) continue;
    const t0 = clamp01(tA + s0 * (tB - tA));
    const t1 = clamp01(tA + s1 * (tB - tA));
    const seg = segmentAt(profile, clamp01(tA + ((s0 + s1) / 2) * (tB - tA)));
    segments.push({
      s0,
      s1,
      z0M: zMap(zOfSegment(seg, t0), floorElevationMm),
      z1M: zMap(zOfSegment(seg, t1), floorElevationMm),
    });
  }
  return { segments };
}

/**
 * Μεταβλητό προφίλ ανά ακμή του chain. Ακμή με `edgeWallIds[i]` που ΔΕΝ είναι
 * `attached` (απών από το `wallRefs`) ή `null` → `null` (επίπεδο fallback στον
 * consumer). Διάσταση = πλήθος ακμών `envelopeFaceEdges`.
 */
export function resolveEnvelopeEdges<S extends ProfileSegment>(
  chain: EnvelopeChain,
  wallRefs: ReadonlyMap<string, WallProfileRef<S>>,
  floorElevationMm: number,
  zMap: ZToMeters,
): (EnvelopeEdge | null)[] {
  const face = chain.exteriorFaceLoop.points;
  const edges = envelopeFaceEdges(chain.exteriorFaceLoop);
  const edgeWallIds = chain.edgeWallIds;
  const out: (EnvelopeEdge | null)[] = [];

  for (let i = 0; i < edges.length; i++) {
    const wallId = edgeWallIds?.[i] ?? null;
    const ref = wallId ? wallRefs.get(wallId) : undefined;
    if (!ref) {
      out.push(null);
      continue;
    }
    out.push(resolveEdgeProfile(face[edges[i][0]], face[edges[i][1]], ref, floorElevationMm, zMap));
  }
  return out;
}

/**
 * Z1 area (m²) contribution ενός chain με μεταβλητό προφίλ: Σ ανά ακμή (μήκος
 * outer-loop × μέσο z ανά sub-segment). Flat ακμή (`edgeProfiles[i] === null`) →
 * `μήκος × fallbackHeightM` (default `0` = καμία συνεισφορά, π.χ. base· το top
 * περνά `fallbackHeightM` = nominal ύψος ώστε flat-only chain = `perimeterM × h`).
 *
 * Μήκος ακμής = `outer-loop edge / sceneScale / 1000` (ίδια convention με
 * `polylinePerimeterMeters`).
 */
export function chainEdgeAreaM2(
  chain: EnvelopeChain,
  edgeProfiles: readonly (EnvelopeEdge | null)[],
  sceneScale: number,
  fallbackHeightM = 0,
): number {
  if (sceneScale === 0) return 0;
  const outer = chain.insulationOuterLoop.points;
  const edges = envelopeFaceEdges(chain.exteriorFaceLoop);
  const metersPerCanvas = 1 / (sceneScale * 1000);
  let area = 0;
  for (let i = 0; i < edges.length; i++) {
    const [a, b] = edges[i];
    const lenM = Math.hypot(outer[b].x - outer[a].x, outer[b].y - outer[a].y) * metersPerCanvas;
    const ep = edgeProfiles[i] ?? null;
    if (!ep) {
      area += lenM * fallbackHeightM;
      continue;
    }
    let weightedH = 0;
    for (const s of ep.segments) weightedH += (s.s1 - s.s0) * ((s.z0M + s.z1M) / 2);
    area += lenM * weightedH;
  }
  return area;
}
