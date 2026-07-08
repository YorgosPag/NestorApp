/**
 * Envelope (ETICS Z1) variable-BASE resolver (ADR-401 (γ) base-attach) — thin wrapper.
 *
 * Δίδυμο του `envelope-wall-top` για τη **βάση** του κελύφους. Όταν ένας τοίχος
 * είναι `baseBinding==='attached'` (η βάση «κατεβαίνει» πάνω στην άνω-παρειά ενός
 * θεμελίου/πεδιλοδοκού — ADR-401 (γ)), ο πάτος του γίνεται **σκαλωτός/κεκλιμένος**
 * (`resolveWallBaseProfile`) και το ETICS κέλυφος πρέπει να ντύνει ΚΑΙ αυτό το
 * κατέβασμα → μεταβλητή βάση **ανά τμήμα περιμέτρου** (mirror της B3b κορυφής).
 *
 * Ο κοινός πυρήνας (edge→profile mapping, segment walking, area) ζει στο SSoT
 * `envelope-edge-profile` — εδώ περνάμε μόνο τη z-normalization βάσης: `baseM`
 * **ΔΕΝ** clamp-άρει στο 0 (⚠️ σε αντίθεση με το top) — η βάση μπορεί να είναι
 * **αρνητική** (κάτω από το πάτωμα, σε θεμέλιο), ώστε το κέλυφος να εκτείνεται κάτω.
 *
 * Pure SSoT — καταναλώνεται από `EnvelopeToThree.envelopeChainToMesh` (3D dual-band)
 * + `envelope-boq-sync` (Z1 area = top − base).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-401-bim-wall-top-base-constraints-attach-to-structural.md §2.5 (γ)
 * @see ./envelope-edge-profile (κοινός πυρήνας top/base)
 * @see ./envelope-wall-top (ο top/lower-envelope δίδυμος — clamp ≥0)
 * @see ./wall-base-profile (resolveWallBaseProfile + WallBaseProfile)
 */

import type { EnvelopeChain } from './envelope-perimeter';
import type { WallBaseProfile } from './wall-base-profile';
import {
  chainEdgeAreaM2,
  resolveEnvelopeEdges,
  type AxisPoint,
  type EnvelopeEdge,
  type EnvelopeEdgeSeg,
} from './envelope-edge-profile';

const MM_TO_M = 0.001;

/** Άξονας + προφίλ βάσης ενός `attached` τοίχου (ίδιο plan space με το chain). */
export interface WallBaseRef {
  readonly start: AxisPoint;
  readonly end: AxisPoint;
  readonly profile: WallBaseProfile;
}

/** Ένα sub-segment βάσης μιας ακμής — alias του κοινού `EnvelopeEdgeSeg` (z μπορεί <0). */
export type EnvelopeEdgeBaseSeg = EnvelopeEdgeSeg;

/** Μεταβλητή βάση μιας ακμής κελύφους — alias του κοινού `EnvelopeEdge`. */
export type EnvelopeEdgeBase = EnvelopeEdge;

/** base mm → μέτρα πάνω από τη βάση ορόφου — **χωρίς** clamp (μπορεί <0, θεμέλιο). */
const baseM = (zmm: number, floorElevationMm: number): number => (zmm - floorElevationMm) * MM_TO_M;

/**
 * Μεταβλητή βάση ανά ακμή του chain. Ακμή χωρίς `attached`-base τοίχο → `null`
 * (επίπεδος πάτος fallback στον consumer). Διάσταση = πλήθος ακμών `envelopeFaceEdges`.
 */
export function resolveEnvelopeEdgeBases(
  chain: EnvelopeChain,
  wallRefs: ReadonlyMap<string, WallBaseRef>,
  floorElevationMm: number,
): (EnvelopeEdgeBase | null)[] {
  return resolveEnvelopeEdges(chain, wallRefs, floorElevationMm, baseM);
}

/**
 * Z1 base contribution (m²) ενός chain: Σ ανά ακμή (μήκος outer-loop × μέση βάση
 * ανά sub-segment). Επίπεδη ακμή (`edgeBases[i] === null`) → **0** (βάση στο
 * nominal floor = 0). Ο consumer αφαιρεί: `Z1 = topArea − baseArea`· επειδή η βάση
 * μπορεί να είναι αρνητική (θεμέλιο κάτω από το πάτωμα), το `top − base` μεγαλώνει.
 */
export function chainBaseAreaM2(
  chain: EnvelopeChain,
  edgeBases: readonly (EnvelopeEdgeBase | null)[],
  sceneScale: number,
): number {
  return chainEdgeAreaM2(chain, edgeBases, sceneScale);
}
