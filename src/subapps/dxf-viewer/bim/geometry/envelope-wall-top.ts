/**
 * Envelope (ETICS Z1) variable-top resolver (ADR-401 Phase B3b) — SSoT.
 *
 * Το κατακόρυφο κέλυφος μόνωσης Z1 ντύνει την εξωτ. παρειά των τοίχων. Όταν ένας
 * τοίχος είναι `attached` (κρέμεται κάτω από δοκάρι/πλάκα — ADR-401), η κορυφή του
 * γίνεται **σκαλωτή/κεκλιμένη** (`resolveWallTopProfile`, Phase A). Η μόνωση πρέπει
 * να ακολουθεί ΑΚΡΙΒΩΣ αυτό το προφίλ **ανά τμήμα περιμέτρου** (όχι ένα επίπεδο
 * max — απόφαση Giorgio §6: ΠΛΗΡΕΣ ΣΚΑΛΩΤΟ ΚΕΛΥΦΟΣ).
 *
 * Mapping perimeter-edge → wall-profile: κάθε ακμή του `chain.exteriorFaceLoop`
 * (ευθυγραμμισμένη με `envelopeFaceEdges`) φέρει `chain.edgeWallIds[i]` = ο τοίχος
 * πηγή (από `ShellEdge.sourceEntityId`, βλ. `envelope-shell.ts`). Προβάλλουμε τα
 * δύο face-endpoints της ακμής στον **άξονα** του τοίχου → `tA,tB ∈ [0,1]`, σπάμε
 * στα profile breakpoints και βγάζουμε **ανεξάρτητα sub-segments** ανά ακμή. Κάθε
 * sub-segment κρατά δικά του `z0M/z1M` ώστε ένα **σκαλοπάτι** (ασυνέχεια κορυφής)
 * να αναπαρίσταται σωστά (δεν μοιράζεται τιμή στο breakpoint· interior-biased eval
 * μέσω του segment που καλύπτει το midpoint — mirror του B2 wall-opening-pieces).
 *
 * ΜΟΝΑΔΕΣ: face/axis στο ΙΔΙΟ plan space (canvas units)· `t`/`s` αδιάστατα. Τα
 * `z*M` είναι **μέτρα πάνω από τη βάση ορόφου** = `(topMm − floorElevationMm)·0.001`,
 * ίδια convention με το `heightM` που τρώει το `envelopeChainToMesh`.
 *
 * Pure SSoT — καταναλώνεται από `BimSceneLayer.addEnvelopeShell` (3D) +
 * `envelope-boq-sync` (Z1 area). Μηδέν globals / React / Firestore.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-401-bim-wall-top-base-constraints-attach-to-structural.md §2.2, §2.4, §5 B3b
 * @see ./wall-top-profile (resolveWallTopProfile + WallTopProfile)
 * @see ./envelope-opening-cuts (envelopeFaceEdges — κοινό edge indexing)
 */

import type { Point3D } from '../types/bim-base';
import type { EnvelopeChain } from './envelope-perimeter';
import type { WallTopProfile, WallTopSegment } from './wall-top-profile';
import { envelopeFaceEdges } from './envelope-opening-cuts';

const MM_TO_M = 0.001;
const EPS = 1e-9;

/** Ελάχιστο 2D σημείο plan space (canvas units). */
export interface AxisPoint {
  readonly x: number;
  readonly y: number;
}

/** Άξονας + προφίλ ενός `attached` τοίχου (ίδιο plan space με το chain). */
export interface WallTopRef {
  readonly start: AxisPoint;
  readonly end: AxisPoint;
  readonly profile: WallTopProfile;
}

/**
 * Ένα sub-segment κορυφής μιας ακμής: από edge-local `s0` έως `s1` (0 = `face[a]`,
 * 1 = `face[b]`), top γραμμικά `z0M → z1M` (ΜΕΤΡΑ πάνω από τη βάση ορόφου).
 */
export interface EnvelopeEdgeTopSeg {
  readonly s0: number;
  readonly s1: number;
  readonly z0M: number;
  readonly z1M: number;
}

/** Μεταβλητή κορυφή μιας ακμής κελύφους — ordered sub-segments που καλύπτουν [0,1]. */
export interface EnvelopeEdgeTop {
  readonly segments: readonly EnvelopeEdgeTopSeg[];
}

const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);

/** Παράμετρος προβολής σημείου `p` στην ευθεία του άξονα `start→end` (αδιάστατη). */
export function projectTOnAxis(start: AxisPoint, end: AxisPoint, p: AxisPoint): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < EPS) return 0;
  return ((p.x - start.x) * dx + (p.y - start.y) * dy) / len2;
}

/** Όλα τα t-boundaries του προφίλ (segment endpoints), αύξοντα, deduped. */
function profileBreakpointTs(profile: WallTopProfile): number[] {
  const set = new Set<number>();
  for (const s of profile.segments) {
    set.add(s.t0);
    set.add(s.t1);
  }
  return [...set].sort((a, b) => a - b);
}

/** Το profile segment που καλύπτει το `t` (πρώτο που ταιριάζει· fallback τελευταίο). */
function segmentAt(profile: WallTopProfile, t: number): WallTopSegment {
  const segs = profile.segments;
  for (const s of segs) {
    if (t >= s.t0 - EPS && t <= s.t1 + EPS) return s;
  }
  return segs[segs.length - 1];
}

/** Top (mm) ενός συγκεκριμένου segment στο `t` (γραμμικά z0→z1, clamped στο span). */
function zOfSegment(seg: WallTopSegment, t: number): number {
  const span = seg.t1 - seg.t0;
  if (span < EPS) return seg.z0mm;
  const tc = t < seg.t0 ? seg.t0 : t > seg.t1 ? seg.t1 : t;
  return seg.z0mm + ((seg.z1mm - seg.z0mm) * (tc - seg.t0)) / span;
}

const topM = (zmm: number, floorElevationMm: number): number =>
  Math.max(0, (zmm - floorElevationMm) * MM_TO_M);

/**
 * Μεταβλητή κορυφή ανά ακμή του chain. Ακμή με `edgeWallIds[i]` που ΔΕΝ είναι
 * `attached` τοίχος (απών από το `wallRefs`) ή `null` → `null` (επίπεδο fallback
 * στον consumer). Διάσταση = πλήθος ακμών `envelopeFaceEdges`.
 */
export function resolveEnvelopeEdgeTops(
  chain: EnvelopeChain,
  wallRefs: ReadonlyMap<string, WallTopRef>,
  floorElevationMm: number,
): (EnvelopeEdgeTop | null)[] {
  const face = chain.exteriorFaceLoop.points;
  const edges = envelopeFaceEdges(chain.exteriorFaceLoop);
  const edgeWallIds = chain.edgeWallIds;
  const out: (EnvelopeEdgeTop | null)[] = [];

  for (let i = 0; i < edges.length; i++) {
    const wallId = edgeWallIds?.[i] ?? null;
    const ref = wallId ? wallRefs.get(wallId) : undefined;
    if (!ref) {
      out.push(null);
      continue;
    }
    out.push(resolveEdgeTop(face[edges[i][0]], face[edges[i][1]], ref, floorElevationMm));
  }
  return out;
}

function resolveEdgeTop(
  fa: Point3D,
  fb: Point3D,
  ref: WallTopRef,
  floorElevationMm: number,
): EnvelopeEdgeTop {
  const tA = projectTOnAxis(ref.start, ref.end, fa);
  const tB = projectTOnAxis(ref.start, ref.end, fb);
  const profile = ref.profile;

  // Degenerate (ακμή κάθετη στον άξονα → tA≈tB): επίπεδη κορυφή στο tA.
  if (Math.abs(tB - tA) < EPS) {
    const z = topM(zOfSegment(segmentAt(profile, clamp01(tA)), clamp01(tA)), floorElevationMm);
    return { segments: [{ s0: 0, s1: 1, z0M: z, z1M: z }] };
  }

  const lo = Math.min(tA, tB);
  const hi = Math.max(tA, tB);
  const sSet = new Set<number>([0, 1]);
  for (const tb of profileBreakpointTs(profile)) {
    if (tb > lo + EPS && tb < hi - EPS) sSet.add(clamp01((tb - tA) / (tB - tA)));
  }
  const splits = [...sSet].sort((a, b) => a - b);

  const segments: EnvelopeEdgeTopSeg[] = [];
  for (let k = 0; k < splits.length - 1; k++) {
    const s0 = splits[k];
    const s1 = splits[k + 1];
    if (s1 - s0 < EPS) continue;
    const t0 = clamp01(tA + s0 * (tB - tA));
    const t1 = clamp01(tA + s1 * (tB - tA));
    // Interior-biased: το segment που καλύπτει το midpoint αποτιμάται και στα δύο
    // άκρα → σκαλοπάτι (ασυνέχεια) δεν «λοξεύει» στο breakpoint.
    const seg = segmentAt(profile, clamp01(tA + ((s0 + s1) / 2) * (tB - tA)));
    segments.push({
      s0,
      s1,
      z0M: topM(zOfSegment(seg, t0), floorElevationMm),
      z1M: topM(zOfSegment(seg, t1), floorElevationMm),
    });
  }
  return { segments };
}

/**
 * Z1 facade area (m²) ενός chain όταν υπάρχει σκαλωτό/κεκλιμένο προφίλ: Σ ανά
 * ακμή (μήκος outer-loop × μέσο ύψος ανά sub-segment). Επίπεδη ακμή (`edgeTops[i]
 * === null`) → `μήκος × fallbackHeightM`. Mirror του `profileGrossAreaM2` (B3a)·
 * για flat-only chain ισούται με `perimeterM × fallbackHeightM` (zero regression).
 *
 * Μήκος ακμής = `outer-loop edge / sceneScale / 1000` (ίδια convention με
 * `polylinePerimeterMeters`, ώστε το flat fallback να αναπαράγει το `perimeterM`).
 */
export function chainProfileAreaM2(
  chain: EnvelopeChain,
  edgeTops: readonly (EnvelopeEdgeTop | null)[],
  fallbackHeightM: number,
  sceneScale: number,
): number {
  if (sceneScale === 0) return 0;
  const outer = chain.insulationOuterLoop.points;
  const edges = envelopeFaceEdges(chain.exteriorFaceLoop);
  const metersPerCanvas = 1 / (sceneScale * 1000);
  let area = 0;
  for (let i = 0; i < edges.length; i++) {
    const [a, b] = edges[i];
    const lenM = Math.hypot(outer[b].x - outer[a].x, outer[b].y - outer[a].y) * metersPerCanvas;
    const et = edgeTops[i] ?? null;
    if (!et) {
      area += lenM * fallbackHeightM;
      continue;
    }
    let weightedH = 0;
    for (const s of et.segments) weightedH += (s.s1 - s.s0) * ((s.z0M + s.z1M) / 2);
    area += lenM * weightedH;
  }
  return area;
}
