/**
 * ADR-396 — Envelope (ETICS) opening cutouts SSoT.
 *
 * Η μόνωση Z1 (κατακόρυφο κέλυφος) ΔΕΝ πρέπει να σκεπάζει πόρτες/παράθυρα: το
 * άνοιγμα είναι διαμπερές και από την εξωτ. πλευρά. Αυτό το SSoT αντιστοιχίζει
 * κάθε άνοιγμα στο `exteriorFaceLoop` του chain και επιστρέφει το **band sub-quad**
 * (canvas units) + το κατακόρυφο εύρος (`sillM`..`headM`, ΜΕΤΡΑ) που πρέπει να
 * «τρυπηθεί».
 *
 * Καταναλωτές (κοινό SSoT — 2D⟷3D parity):
 *   - 2D: `EnvelopeRenderer.renderOpeningCuts` (`destination-out` πάνω στο band).
 *   - 3D: `envelopeChainToMesh` (κατακόρυφο split: κάτω από ποδιά + πάνω από πρέκι).
 *
 * Αλγόριθμος (ανά άνοιγμα):
 *   1. Δύο άκρα-πλάτους στον άξονα τοίχου: `position ± dir·(width/2)` (mm → canvas).
 *   2. Πλησιέστερη ακμή του `exteriorFaceLoop` στο κέντρο → `edgeIndex`.
 *   3. Προβολή των δύο άκρων στην ακμή → `[tStart, tEnd]` (param 0..1).
 *   4. Band sub-quad = `[O_a, O_b, F_b, F_a]` (outer fwd → inner reversed), όπου
 *      `O` = `insulationOuterLoop` (1:1 offset, mitered corners encoded στις κορυφές).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-396-bim-external-thermal-envelope-etics.md §3, §5
 * @see ./envelope-perimeter (EnvelopeChain — geometry SSoT)
 */

import type { Point3D, Polyline3D } from '../types/bim-base';
import type { SceneUnits } from '../../utils/scene-units';
import { mmToSceneUnits } from '../../utils/scene-units';
import type { EnvelopeChain } from './envelope-perimeter';

const MM_TO_M = 1 / 1000;
/** Ελάχιστο μήκος span (param) για να μετράει — αποφεύγει degenerate τρύπες. */
const MIN_SPAN_T = 1e-6;
/** Snap για ανίχνευση closing-duplicate κορυφής (canvas units). */
const CLOSE_EPS = 1e-6;

/**
 * Λίστα ακμών (ζεύγη indices) του face loop. Προσθέτει τη wrap-around ακμή
 * `[n-1, 0]` όταν το loop είναι `closed` ΚΑΙ δεν έχει closing-duplicate κορυφή
 * (το `assembleFaceLoop` δεν επαναλαμβάνει το πρώτο σημείο). **Κοινό SSoT** για
 * cuts (`computeEnvelopeOpeningCuts`) + 3D builder (`envelopeChainToMesh`) ώστε
 * το `edgeIndex` να ευθυγραμμίζεται απόλυτα.
 */
export function envelopeFaceEdges(loop: Polyline3D): Array<[number, number]> {
  const pts = loop.points;
  const n = pts.length;
  const edges: Array<[number, number]> = [];
  for (let j = 0; j < n - 1; j++) edges.push([j, j + 1]);
  if (loop.closed && n >= 3) {
    const a = pts[0];
    const b = pts[n - 1];
    const dup = Math.abs(a.x - b.x) < CLOSE_EPS && Math.abs(a.y - b.y) < CLOSE_EPS;
    if (!dup) edges.push([n - 1, 0]);
  }
  return edges;
}

// ============================================================================
// PUBLIC TYPES
// ============================================================================

/** Ελάχιστο structural shape ανοίγματος (το `OpeningEntity` το ικανοποιεί). */
export interface OpeningForCut {
  readonly params: {
    readonly wallId: string;
    /** mm. Πλάτος ανοίγματος κατά μήκος του άξονα. */
    readonly width: number;
    /** mm. Ποδιά πάνω από το δάπεδο (0 για πόρτες). */
    readonly sillHeight: number;
    /** mm. Ύψος ανοίγματος (ποδιά → πρέκι). */
    readonly height: number;
    /**
     * Z4 περβάζι (ETICS reveal). Όταν υπάρχει, το Z1 cut **στενεύει** κατά
     * `thickness_m` σε κάθε άκρο ώστε η μόνωση πρόσοψης να ΤΥΛΙΓΕΙ τη γωνία και να
     * σκεπάζει το εξωτ. άκρο της παραστάδας (αλλιώς μένει αμόνωτο κενό στη γωνία).
     */
    readonly revealInsulation?: { readonly thickness_m: number };
  };
  readonly geometry?: {
    /** mm. Κέντρο cutout στον άξονα τοίχου (world). */
    readonly position?: Point3D;
    /** rad. Διεύθυνση άξονα τοίχου. */
    readonly rotation?: number;
    /** mm. Ορθογώνιο cutout (4 κορυφές, world) — fallback όταν λείπει position/rotation. */
    readonly outline?: { readonly vertices: readonly Point3D[] };
  };
}

/** Ένα cutout στη μόνωση Z1 — αντιστοίχιση ανοίγματος σε ακμή του exterior face loop. */
export interface EnvelopeOpeningCut {
  /** Index ακμής `face[edgeIndex] → face[edgeIndex+1]`. */
  readonly edgeIndex: number;
  /** Param 0..1 κατά μήκος της ακμής (tStart < tEnd). */
  readonly tStart: number;
  readonly tEnd: number;
  /** ΜΕΤΡΑ. Ποδιά πάνω από τη βάση ορόφου. */
  readonly sillM: number;
  /** ΜΕΤΡΑ. Πρέκι πάνω από τη βάση ορόφου. */
  readonly headM: number;
  /** Canvas-unit band sub-quad `[O_a, O_b, F_b, F_a]` (outer fwd → inner reversed). */
  readonly bandQuad: readonly Point3D[];
}

// ============================================================================
// GEOMETRY HELPERS
// ============================================================================

function lerp(a: Point3D, b: Point3D, t: number): Point3D {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: 0 };
}

interface Projection {
  readonly t: number;
  readonly dist2: number;
}

/** Προβολή σημείου σε ευθύγραμμο τμήμα [a,b] — clamped param + απόσταση². */
function projectOnEdge(p: { x: number; y: number }, a: Point3D, b: Point3D): Projection {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-12) {
    const ex = p.x - a.x;
    const ey = p.y - a.y;
    return { t: 0, dist2: ex * ex + ey * ey };
  }
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = a.x + t * dx;
  const cy = a.y + t * dy;
  const ex = p.x - cx;
  const ey = p.y - cy;
  return { t, dist2: ex * ex + ey * ey };
}

type XY = { readonly x: number; readonly y: number };

interface OpeningEndpoints {
  readonly center: XY;
  /** Οι 2 γωνίες της παρειάς **start** (outer + inner). Fallback: ίδιο σημείο ×2. */
  readonly startCorners: readonly [XY, XY];
  /** Οι 2 γωνίες της παρειάς **end** (outer + inner). Fallback: ίδιο σημείο ×2. */
  readonly endCorners: readonly [XY, XY];
}

/**
 * Γωνίες παρειών + κέντρο σε **canvas units** (ίδιος χώρος με το face loop).
 *
 * ⚠️ ΜΟΝΑΔΕΣ: το `OpeningGeometry` (`position`/`outline`) είναι **canvas/scene
 * units** — `computeOpeningGeometry` περπατά τα scene-unit axis vertices (το doc
 * comment «mm» αφορά μόνο τα `params`). Άρα ΔΕΝ γίνεται κλιμάκωση εδώ. Το
 * `mmFactor` χρησιμοποιείται ΜΟΝΟ στο fallback (το `params.width` είναι mm).
 *
 * Primary: `outline` (4 κορυφές CCW) → **και τις δύο γωνίες** κάθε άκρου. Η
 * exterior-face γωνία (αυτή που κείτεται στο face loop) επιλέγεται αργότερα κατά
 * την προβολή ώστε το Z1 cut boundary να ευθυγραμμίζεται με την παρειά τοίχου/Z4
 * (collinear) ακόμη και σε λοξά/mitered faces — ΟΧΙ το axis-midpoint που σε λοξή
 * ακμή μετατοπίζεται πλευρικά. Fallback: `position + rotation` (καμία πληροφορία
 * πάχους → η παρειά είναι το axis σημείο, γωνία ×2).
 */
function openingEndpoints(op: OpeningForCut, mmFactor: number): OpeningEndpoints | null {
  const g = op.geometry;

  // Primary — outline corners (CCW: start-a, end-a, end-b, start-b).
  const verts = g?.outline?.vertices;
  if (verts && verts.length >= 4) {
    const startCorners: readonly [XY, XY] = [verts[0], verts[3]];
    const endCorners: readonly [XY, XY] = [verts[1], verts[2]];
    return {
      center: {
        x: (verts[0].x + verts[1].x + verts[2].x + verts[3].x) / 4,
        y: (verts[0].y + verts[1].y + verts[2].y + verts[3].y) / 4,
      },
      startCorners,
      endCorners,
    };
  }

  // Fallback — position (canvas) + rotation· width mm → canvas via mmFactor.
  if (g?.position && typeof g.rotation === 'number') {
    const c = g.position;
    const half = (op.params.width / 2) * mmFactor;
    const dx = Math.cos(g.rotation);
    const dy = Math.sin(g.rotation);
    const e1: XY = { x: c.x - dx * half, y: c.y - dy * half };
    const e2: XY = { x: c.x + dx * half, y: c.y + dy * half };
    return { center: { x: c.x, y: c.y }, startCorners: [e1, e1], endCorners: [e2, e2] };
  }

  return null;
}

/**
 * `t` της γωνίας που κείτεται στο **exterior face** (ελάχιστη απόσταση² στην ακμή).
 * Η exterior-face γωνία πέφτει πάνω στην ακμή (dist²≈0) → η προβολή είναι ταυτοτική
 * → το cut boundary ευθυγραμμίζεται με την παρειά τοίχου/Z4.
 */
function projectExteriorCorner(corners: readonly XY[], a: Point3D, b: Point3D): number {
  let bestT = 0;
  let bestDist2 = Infinity;
  for (const c of corners) {
    const pr = projectOnEdge(c, a, b);
    if (pr.dist2 < bestDist2) { bestDist2 = pr.dist2; bestT = pr.t; }
  }
  return bestT;
}

// ============================================================================
// PUBLIC ENTRY
// ============================================================================

/**
 * Υπολογίζει τα cutouts ανοιγμάτων για ένα envelope chain. Φιλτράρει εσωτερικά
 * μόνο τα ανοίγματα των τοίχων του chain (`chain.wallIds`).
 *
 * @param chain      το chain από `computeEnvelopePerimeter`.
 * @param openings   όλα τα ανοίγματα της σκηνής (φιλτράρονται κατά wallId).
 * @param sceneUnits μονάδες σκηνής (ίδιες με αυτές που έχτισαν το chain).
 */
export function computeEnvelopeOpeningCuts(
  chain: EnvelopeChain,
  openings: readonly OpeningForCut[],
  sceneUnits: SceneUnits,
): EnvelopeOpeningCut[] {
  const face = chain.exteriorFaceLoop.points;
  const outer = chain.insulationOuterLoop.points;
  // 1:1 offset απαραίτητο για να lerp-άρουμε το outer με το ίδιο param.
  if (face.length < 2 || outer.length !== face.length) return [];

  const wallSet = new Set(chain.wallIds);
  const mmFactor = mmToSceneUnits(sceneUnits);
  const edges = envelopeFaceEdges(chain.exteriorFaceLoop);
  const cuts: EnvelopeOpeningCut[] = [];

  for (const op of openings) {
    if (!wallSet.has(op.params.wallId)) continue;
    const ep = openingEndpoints(op, mmFactor);
    if (!ep) continue;

    // Πλησιέστερη ακμή στο κέντρο (αποφεύγει split σε δύο ακμές στη γωνία).
    let bestEdge = -1;
    let bestDist = Infinity;
    for (let i = 0; i < edges.length; i++) {
      const [a, b] = edges[i];
      const { dist2 } = projectOnEdge(ep.center, face[a], face[b]);
      if (dist2 < bestDist) { bestDist = dist2; bestEdge = i; }
    }
    if (bestEdge < 0) continue;

    const [ai, bi] = edges[bestEdge];
    const F0 = face[ai];
    const F1 = face[bi];
    // Προβολή της exterior-face γωνίας κάθε άκρου (αυτή που κείτεται ΠΑΝΩ στην ακμή),
    // ΟΧΙ του axis-midpoint — αλλιώς σε λοξό face η προβολή εσωτερικού σημείου
    // μετατοπίζεται πλευρικά → Z1 boundary ≠ παρειά τοίχου/Z4.
    const ta = projectExteriorCorner(ep.startCorners, F0, F1);
    const tb = projectExteriorCorner(ep.endCorners, F0, F1);
    const tStart = Math.min(ta, tb);
    const tEnd = Math.max(ta, tb);
    if (tEnd - tStart < MIN_SPAN_T) continue;

    // ADR-396 (2026-05-30) — Το Z1 cut = το ΕΛΕΥΘΕΡΟ άνοιγμα (κούφωμα). Η παλιά
    // "reveal wrap" (στένεμα κατά revealThk) ΑΦΑΙΡΕΘΗΚΕ: η μόνωση Z4 τρώει πλέον τον
    // τοίχο (structural cutout), όχι το άνοιγμα — η Z1 πρόσοψη συνεχίζει μέχρι το free
    // edge και η Z4 ring γεμίζει εμπρός (collinear). Το `op.params.revealInsulation`
    // δεν χρησιμοποιείται πλέον εδώ.
    const O0 = outer[ai];
    const O1 = outer[bi];

    cuts.push({
      edgeIndex: bestEdge,
      tStart,
      tEnd,
      sillM: op.params.sillHeight * MM_TO_M,
      headM: (op.params.sillHeight + op.params.height) * MM_TO_M,
      bandQuad: [lerp(O0, O1, tStart), lerp(O0, O1, tEnd), lerp(F0, F1, tEnd), lerp(F0, F1, tStart)],
    });
  }

  return cuts;
}
