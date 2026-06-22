/**
 * Roof straight-skeleton solver — adapter (ADR-417 Φ2). Pure SSoT.
 *
 * «Λεπτός» προσαρμογέας ανάμεσα στη γενική μηχανή straight-skeleton
 * (`shared/straight-skeleton.ts`) και το μοντέλο στέγης: παίρνει το διαμέρισμα
 * όψεων (ανά ακμή) + τα τόξα και τα μετατρέπει σε `RoofFace[]` + `RoofRidgeLine[]`,
 * **επαναχρησιμοποιώντας ΑΥΤΟΥΣΙΑ** τα `makeFace` (ανύψωση + εμβαδά) και `roofZmm`
 * (height field) του `roof-lower-envelope.ts`. Έτσι η ανύψωση γίνεται με τις
 * **πραγματικές per-edge κλίσεις** (Φ1) — Revit-correct ύψη — ενώ το διαμέρισμα
 * προκύπτει από το skeleton (σωστή τετράρριχτη σε κοίλα σχήματα Γ/Τ/Π).
 *
 * Καλείται ΜΟΝΟ όταν **όλες** οι ακμές ορίζουν κλίση (hip preset — `applyRoofShapePreset('hip')`):
 * τότε κάθε ακμή → ένα «νερό». Μικτά (αετώματα/gable σε κοίλο) → `null` (ο
 * orchestrator κάνει graceful fallback στο lower-envelope).
 *
 * @see bim/geometry/shared/straight-skeleton.ts — η μηχανή (διαμέρισμα + τόξα)
 * @see bim/geometry/roof-lower-envelope.ts — makeFace / roofZmm (reuse)
 * @see docs/centralized-systems/reference/adrs/ADR-417-bim-roof-element.md §10
 */

import type { RoofFace, RoofRidgeLine } from '../types/roof-types';
import {
  makeFace,
  roofZmm,
  type EavePlane,
  type LowerEnvelopeResult,
  type Vec2,
} from './roof-lower-envelope';
import { computeStraightSkeleton, type SkeletonArc } from './shared/straight-skeleton';

/** mm — κάτω από αυτό μια ακμή θεωρείται οριζόντια (ridge vs hip). Mirror lower-envelope. */
const HORIZONTAL_Z_EPS = 1;
/** canvas — κάτω από αυτό ένα τόξο είναι εκφυλισμένο (μηδενικό μήκος). */
const DEGENERATE_ARC_EPS = 1e-6;

/** Μετατρέπει ένα skeleton τόξο σε γραμμή κορφιά/hip/λουκιού (z-lift via `roofZmm`). */
function arcToRidge(
  arc: SkeletonArc,
  planes: readonly EavePlane[],
  basePivotZ: number,
  s: number,
): RoofRidgeLine {
  const za = roofZmm(planes, basePivotZ, s, arc.a);
  const zb = roofZmm(planes, basePivotZ, s, arc.b);
  const horizontal = Math.abs(za - zb) < HORIZONTAL_Z_EPS;
  // Τόξο που ξεκινά από κοίλη (reflex) κορυφή = λούκι (valley)· αλλιώς οριζόντιο →
  // κορφιάς (ridge), κεκλιμένο → hip.
  const kind: RoofRidgeLine['kind'] = arc.fromReflex ? 'valley' : horizontal ? 'ridge' : 'hip';
  return {
    a: { x: arc.a.x, y: arc.a.y, z: za },
    b: { x: arc.b.x, y: arc.b.y, z: zb },
    kind,
  };
}

/**
 * Λύνει τη στέγη μέσω straight skeleton. Επιστρέφει `null` όταν: η μηχανή
 * αποτυγχάνει (degenerate), δεν ορίζουν **όλες** οι ακμές κλίση (μικτό/αέτωμα), ή
 * το διαμέρισμα δεν ταιριάζει με τους δείκτες κλίσης. Pure / idempotent.
 *
 * @param footprint2D       κορυφές footprint (canvas units, CCW).
 * @param planes            τα κεκλιμένα επίπεδα (από `resolveEavePlanes`).
 * @param slopeEdgeIndices  δείκτης ακμής ανά plane (παράλληλο του `planes`).
 */
export function solveRoofByStraightSkeleton(
  footprint2D: readonly Vec2[],
  planes: readonly EavePlane[],
  slopeEdgeIndices: readonly number[],
  basePivotZ: number,
  s: number,
  canvasToM: number,
): LowerEnvelopeResult | null {
  // Απαιτεί ΟΛΕΣ τις ακμές slope-defining (hip): #planes == #ακμές footprint.
  if (planes.length !== footprint2D.length || slopeEdgeIndices.length !== planes.length) {
    return null;
  }
  const sk = computeStraightSkeleton(footprint2D);
  if (!sk.ok || sk.faces.length !== footprint2D.length) return null;

  const ratioByEdge = new Map<number, number>();
  slopeEdgeIndices.forEach((edgeIdx, k) => ratioByEdge.set(edgeIdx, planes[k].ratio));

  const faces: RoofFace[] = [];
  for (const f of sk.faces) {
    const ratio = ratioByEdge.get(f.edgeIndex);
    if (ratio === undefined) return null; // ακμή χωρίς plane → fallback
    const poly2D: Vec2[] = f.polygon.map((p) => ({ x: p.x, y: p.y }));
    faces.push(makeFace(poly2D, ratio, planes, basePivotZ, s, canvasToM));
  }

  const ridges: RoofRidgeLine[] = [];
  for (const arc of sk.arcs) {
    if (Math.hypot(arc.b.x - arc.a.x, arc.b.y - arc.a.y) < DEGENERATE_ARC_EPS) continue;
    ridges.push(arcToRidge(arc, planes, basePivotZ, s));
  }

  return { faces, ridges };
}
