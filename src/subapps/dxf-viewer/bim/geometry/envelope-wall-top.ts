/**
 * Envelope (ETICS Z1) variable-TOP resolver (ADR-401 Phase B3b) — thin wrapper.
 *
 * Το κατακόρυφο κέλυφος μόνωσης Z1 ντύνει την εξωτ. παρειά των τοίχων. Όταν ένας
 * τοίχος είναι `attached` (κρέμεται κάτω από δοκάρι/πλάκα — ADR-401), η κορυφή του
 * γίνεται **σκαλωτή/κεκλιμένη** (`resolveWallTopProfile`, Phase A) και η μόνωση
 * ακολουθεί ΑΚΡΙΒΩΣ αυτό το προφίλ **ανά τμήμα περιμέτρου** (απόφαση Giorgio §6:
 * ΠΛΗΡΕΣ ΣΚΑΛΩΤΟ ΚΕΛΥΦΟΣ — όχι επίπεδο max).
 *
 * Ο κοινός πυρήνας (edge→profile mapping, segment walking, area) ζει στο SSoT
 * `envelope-edge-profile` — εδώ περνάμε μόνο τη z-normalization κορυφής: `topM`
 * clamp-άρει ≥0 (η κορυφή δεν κατεβαίνει κάτω από τη βάση ορόφου).
 *
 * Pure SSoT — καταναλώνεται από `BimSceneLayer.addEnvelopeShell` (3D) +
 * `envelope-boq-sync` (Z1 area).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-401-bim-wall-top-base-constraints-attach-to-structural.md §2.2, §2.4, §5 B3b
 * @see ./envelope-edge-profile (κοινός πυρήνας top/base)
 * @see ./envelope-wall-base (ο base/upper-envelope δίδυμος — χωρίς clamp)
 * @see ./wall-top-profile (resolveWallTopProfile + WallTopProfile)
 */

import type { EnvelopeChain } from './envelope-perimeter';
import type { WallTopProfile } from './wall-top-profile';
import {
  chainEdgeAreaM2,
  resolveEnvelopeEdges,
  type AxisPoint,
  type EnvelopeEdge,
  type EnvelopeEdgeSeg,
} from './envelope-edge-profile';

const MM_TO_M = 0.001;

// SSoT re-exports — ο πυρήνας/geom primitives ζουν στο envelope-edge-profile.
export { projectTOnAxis } from './envelope-edge-profile';
export type { AxisPoint } from './envelope-edge-profile';

/** Άξονας + προφίλ κορυφής ενός `attached` τοίχου (ίδιο plan space με το chain). */
export interface WallTopRef {
  readonly start: AxisPoint;
  readonly end: AxisPoint;
  readonly profile: WallTopProfile;
}

/** Ένα sub-segment κορυφής μιας ακμής — alias του κοινού `EnvelopeEdgeSeg`. */
export type EnvelopeEdgeTopSeg = EnvelopeEdgeSeg;

/** Μεταβλητή κορυφή μιας ακμής κελύφους — alias του κοινού `EnvelopeEdge`. */
export type EnvelopeEdgeTop = EnvelopeEdge;

/** top mm → μέτρα πάνω από τη βάση ορόφου, clamp ≥0 (δεν κατεβαίνει κάτω από πάτωμα). */
const topM = (zmm: number, floorElevationMm: number): number =>
  Math.max(0, (zmm - floorElevationMm) * MM_TO_M);

/**
 * Μεταβλητή κορυφή ανά ακμή του chain. Ακμή χωρίς `attached` τοίχο → `null`
 * (επίπεδο fallback στον consumer). Διάσταση = πλήθος ακμών `envelopeFaceEdges`.
 */
export function resolveEnvelopeEdgeTops(
  chain: EnvelopeChain,
  wallRefs: ReadonlyMap<string, WallTopRef>,
  floorElevationMm: number,
): (EnvelopeEdgeTop | null)[] {
  return resolveEnvelopeEdges(chain, wallRefs, floorElevationMm, topM);
}

/**
 * Z1 facade area (m²) ενός chain: Σ ανά ακμή (μήκος outer-loop × μέσο ύψος ανά
 * sub-segment). Επίπεδη ακμή (`edgeTops[i] === null`) → `μήκος × fallbackHeightM`·
 * για flat-only chain ισούται με `perimeterM × fallbackHeightM` (zero regression).
 */
export function chainProfileAreaM2(
  chain: EnvelopeChain,
  edgeTops: readonly (EnvelopeEdgeTop | null)[],
  fallbackHeightM: number,
  sceneScale: number,
): number {
  return chainEdgeAreaM2(chain, edgeTops, sceneScale, fallbackHeightM);
}
