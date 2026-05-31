/**
 * Envelope (ETICS Z1) variable-BASE resolver (ADR-401 (γ) base-attach) — SSoT.
 *
 * Δίδυμο του `envelope-wall-top.ts` για τη **βάση** του κελύφους. Όταν ένας τοίχος
 * είναι `baseBinding==='attached'` (η βάση «κατεβαίνει» πάνω στην άνω-παρειά ενός
 * θεμελίου/πεδιλοδοκού — ADR-401 (γ)), ο πάτος του γίνεται **σκαλωτός/κεκλιμένος**
 * (`resolveWallBaseProfile`, upper-envelope). Το ETICS κέλυφος πρέπει να ντύνει
 * ΚΑΙ αυτό το κατέβασμα → μεταβλητή βάση **ανά τμήμα περιμέτρου** (mirror της B3b
 * μεταβλητής κορυφής).
 *
 * Mapping perimeter-edge → wall-profile: ΑΚΡΙΒΩΣ ίδιο με το top resolver — κάθε
 * ακμή του `chain.exteriorFaceLoop` φέρει `chain.edgeWallIds[i]`· προβάλλουμε τα
 * δύο face-endpoints στον άξονα του τοίχου → `tA,tB`, σπάμε στα base breakpoints
 * και βγάζουμε ανεξάρτητα sub-segments (σκαλοπάτι βάσης = καθαρή ασυνέχεια).
 *
 * ΜΟΝΑΔΕΣ: face/axis στο ΙΔΙΟ plan space (canvas units)· τα `z*M` είναι **μέτρα
 * πάνω από τη βάση ορόφου** = `(baseMm − floorElevationMm)·0.001`. ⚠️ ΣΕ ΑΝΤΙΘΕΣΗ
 * με το top, **ΔΕΝ** clamp-άρονται στο 0 — η βάση μπορεί να είναι **αρνητική**
 * (κάτω από το πάτωμα, σε θεμέλιο), ώστε το κέλυφος να εκτείνεται προς τα κάτω.
 *
 * Pure SSoT — καταναλώνεται από `EnvelopeToThree.envelopeChainToMesh` (3D dual-band)
 * + `envelope-boq-sync` (Z1 area = top − base). Reuse `projectTOnAxis` (SSoT, top).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-401-bim-wall-top-base-constraints-attach-to-structural.md §2.5 (γ)
 * @see ./envelope-wall-top (resolveEnvelopeEdgeTops — ο top/lower-envelope δίδυμος)
 * @see ./wall-base-profile (resolveWallBaseProfile + WallBaseProfile)
 */

import type { Point3D } from '../types/bim-base';
import type { EnvelopeChain } from './envelope-perimeter';
import type { WallBaseProfile, WallBaseSegment } from './wall-base-profile';
import { envelopeFaceEdges } from './envelope-opening-cuts';
import { projectTOnAxis, type AxisPoint } from './envelope-wall-top';

const MM_TO_M = 0.001;
const EPS = 1e-9;

/** Άξονας + προφίλ βάσης ενός `attached` τοίχου (ίδιο plan space με το chain). */
export interface WallBaseRef {
  readonly start: AxisPoint;
  readonly end: AxisPoint;
  readonly profile: WallBaseProfile;
}

/**
 * Ένα sub-segment βάσης μιας ακμής: από edge-local `s0` έως `s1` (0 = `face[a]`,
 * 1 = `face[b]`), base γραμμικά `z0M → z1M` (ΜΕΤΡΑ πάνω από τη βάση ορόφου· **μπορεί
 * < 0** για θεμέλιο κάτω από το πάτωμα).
 */
export interface EnvelopeEdgeBaseSeg {
  readonly s0: number;
  readonly s1: number;
  readonly z0M: number;
  readonly z1M: number;
}

/** Μεταβλητή βάση μιας ακμής κελύφους — ordered sub-segments που καλύπτουν [0,1]. */
export interface EnvelopeEdgeBase {
  readonly segments: readonly EnvelopeEdgeBaseSeg[];
}

const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);

/** Όλα τα t-boundaries του προφίλ (segment endpoints), αύξοντα, deduped. */
function baseBreakpointTs(profile: WallBaseProfile): number[] {
  const set = new Set<number>();
  for (const s of profile.segments) {
    set.add(s.t0);
    set.add(s.t1);
  }
  return [...set].sort((a, b) => a - b);
}

/** Το base segment που καλύπτει το `t` (πρώτο που ταιριάζει· fallback τελευταίο). */
function segmentAt(profile: WallBaseProfile, t: number): WallBaseSegment {
  const segs = profile.segments;
  for (const s of segs) {
    if (t >= s.t0 - EPS && t <= s.t1 + EPS) return s;
  }
  return segs[segs.length - 1];
}

/** Base (mm) ενός συγκεκριμένου segment στο `t` (γραμμικά z0→z1, clamped στο span). */
function zOfSegment(seg: WallBaseSegment, t: number): number {
  const span = seg.t1 - seg.t0;
  if (span < EPS) return seg.z0mm;
  const tc = t < seg.t0 ? seg.t0 : t > seg.t1 ? seg.t1 : t;
  return seg.z0mm + ((seg.z1mm - seg.z0mm) * (tc - seg.t0)) / span;
}

/** Absolute mm → meters πάνω από τη βάση ορόφου — **χωρίς** clamp (μπορεί < 0). */
const baseM = (zmm: number, floorElevationMm: number): number => (zmm - floorElevationMm) * MM_TO_M;

/**
 * Μεταβλητή βάση ανά ακμή του chain. Ακμή με `edgeWallIds[i]` που ΔΕΝ είναι
 * `attached`-base τοίχος (απών από το `wallRefs`) ή `null` → `null` (επίπεδος πάτος
 * fallback στον consumer). Διάσταση = πλήθος ακμών `envelopeFaceEdges`.
 */
export function resolveEnvelopeEdgeBases(
  chain: EnvelopeChain,
  wallRefs: ReadonlyMap<string, WallBaseRef>,
  floorElevationMm: number,
): (EnvelopeEdgeBase | null)[] {
  const face = chain.exteriorFaceLoop.points;
  const edges = envelopeFaceEdges(chain.exteriorFaceLoop);
  const edgeWallIds = chain.edgeWallIds;
  const out: (EnvelopeEdgeBase | null)[] = [];

  for (let i = 0; i < edges.length; i++) {
    const wallId = edgeWallIds?.[i] ?? null;
    const ref = wallId ? wallRefs.get(wallId) : undefined;
    if (!ref) {
      out.push(null);
      continue;
    }
    out.push(resolveEdgeBase(face[edges[i][0]], face[edges[i][1]], ref, floorElevationMm));
  }
  return out;
}

function resolveEdgeBase(
  fa: Point3D,
  fb: Point3D,
  ref: WallBaseRef,
  floorElevationMm: number,
): EnvelopeEdgeBase {
  const tA = projectTOnAxis(ref.start, ref.end, fa);
  const tB = projectTOnAxis(ref.start, ref.end, fb);
  const profile = ref.profile;

  // Degenerate (ακμή κάθετη στον άξονα → tA≈tB): επίπεδος πάτος στο tA.
  if (Math.abs(tB - tA) < EPS) {
    const z = baseM(zOfSegment(segmentAt(profile, clamp01(tA)), clamp01(tA)), floorElevationMm);
    return { segments: [{ s0: 0, s1: 1, z0M: z, z1M: z }] };
  }

  const lo = Math.min(tA, tB);
  const hi = Math.max(tA, tB);
  const sSet = new Set<number>([0, 1]);
  for (const tb of baseBreakpointTs(profile)) {
    if (tb > lo + EPS && tb < hi - EPS) sSet.add(clamp01((tb - tA) / (tB - tA)));
  }
  const splits = [...sSet].sort((a, b) => a - b);

  const segments: EnvelopeEdgeBaseSeg[] = [];
  for (let k = 0; k < splits.length - 1; k++) {
    const s0 = splits[k];
    const s1 = splits[k + 1];
    if (s1 - s0 < EPS) continue;
    const t0 = clamp01(tA + s0 * (tB - tA));
    const t1 = clamp01(tA + s1 * (tB - tA));
    // Interior-biased: το segment που καλύπτει το midpoint αποτιμάται και στα δύο
    // άκρα → σκαλοπάτι (ασυνέχεια βάσης) δεν «λοξεύει» στο breakpoint.
    const seg = segmentAt(profile, clamp01(tA + ((s0 + s1) / 2) * (tB - tA)));
    segments.push({
      s0,
      s1,
      z0M: baseM(zOfSegment(seg, t0), floorElevationMm),
      z1M: baseM(zOfSegment(seg, t1), floorElevationMm),
    });
  }
  return { segments };
}

/**
 * Z1 base contribution (m²) ενός chain όταν υπάρχει σκαλωτό/κεκλιμένο προφίλ
 * βάσης: Σ ανά ακμή (μήκος outer-loop × μέση βάση ανά sub-segment). Δίδυμο του
 * `chainProfileAreaM2` αλλά **χωρίς fallback** — επίπεδη ακμή (`edgeBases[i] ===
 * null`) συνεισφέρει **0** (βάση στο nominal floor = 0 → μηδέν κατέβασμα).
 *
 * Ο consumer αφαιρεί αυτή την επιφάνεια από το top facade area:
 * `Z1 = topArea − baseArea`. Επειδή η βάση μπορεί να είναι αρνητική (θεμέλιο κάτω
 * από το πάτωμα), η συνεισφορά είναι αρνητική → το `top − base` μεγαλώνει σωστά.
 *
 * Μήκος ακμής = `outer-loop edge / sceneScale / 1000` (ίδια convention με το top).
 */
export function chainBaseAreaM2(
  chain: EnvelopeChain,
  edgeBases: readonly (EnvelopeEdgeBase | null)[],
  sceneScale: number,
): number {
  if (sceneScale === 0) return 0;
  const outer = chain.insulationOuterLoop.points;
  const edges = envelopeFaceEdges(chain.exteriorFaceLoop);
  const metersPerCanvas = 1 / (sceneScale * 1000);
  let area = 0;
  for (let i = 0; i < edges.length; i++) {
    const eb = edgeBases[i] ?? null;
    if (!eb) continue;
    const [a, b] = edges[i];
    const lenM = Math.hypot(outer[b].x - outer[a].x, outer[b].y - outer[a].y) * metersPerCanvas;
    let weightedH = 0;
    for (const s of eb.segments) weightedH += (s.s1 - s.s0) * ((s.z0M + s.z1M) / 2);
    area += lenM * weightedH;
  }
  return area;
}
