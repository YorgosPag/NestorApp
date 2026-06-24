/**
 * ADR-514 Φ-magnet — Polar/Cartesian **Magnet** για γραμμικά μέλη (τοίχος/δοκάρι), pure SSoT.
 *
 * Δίνει στο **START** ενός γραμμικού μέλους την ΙΔΙΑ «μαγνητική» τοποθέτηση με την **κολώνα** (ADR-398
 * §3.13/§3.15): όταν ο cursor είναι **εντός κύκλου** → κουμπώνει στο πολικό πλέγμα (κέντρο / δακτύλιος∩
 * ακτίνα)· όταν είναι **εντός ορθογωνίου** → στο καρτεσιανό πλέγμα (κέντρο / 9-point / grid∩). Έτσι το
 * φάντασμα δοκαριού πριν το 1ο κλικ συμπεριφέρεται **όπως της κολόνας** (Giorgio 2026-06-24, πλήρης ενοποίηση).
 *
 * **FULL SSoT — μηδέν νέα geometry:** reuse ΑΥΤΟΥΣΙΟΙ οι point-snappers της κολόνας
 * (`resolvePolarDiskSnap` + `resolveRectCartesianSnap`). Εδώ γίνεται ΜΟΝΟ η **προσαρμογή** του snapped
 * **σημείου** σε `MemberGhostSnapResult` (start = magnet position· end = μικρό ghost προς +X, ίδιο με το
 * free-fallback του member ghost· faceFrame = polar R/θ frame — το rect δίνει τα 4 dx/dy dims ξεχωριστά
 * στο preview, όπως ακριβώς κάνει και το `generateColumnPreview`).
 *
 * **Nearest-wins** ανάμεσα σε όλους τους δίσκους/ορθογώνια (ίδια λογική με τον column resolver). Ο caller
 * (ο εγκέφαλος) το καλεί **ΜΟΝΟ ως fallback** όταν καμία παρειά μέλους/κολώνας δεν είναι εντός capture
 * (member-face-first): κοντά σε μέλος → T-framing/flush νικά· σε ανοιχτό δίσκο/ορθογώνιο → magnet.
 *
 * Pure — zero React/DOM/store. Μονάδες: scene units.
 *
 * @see ../columns/polar-disk-snap.ts — resolvePolarDiskSnap (reuse, ΜΗΔΕΝ polar math εδώ)
 * @see ../columns/rect-cartesian-snap.ts — resolveRectCartesianSnap (reuse)
 * @see ./bim-cursor-snap.ts — ο εγκέφαλος που το καλεί (member branch fallback)
 * @see docs/centralized-systems/reference/adrs/ADR-398-column-placement-snap.md §3.13/§3.15
 * @see docs/centralized-systems/reference/adrs/ADR-514-unified-bim-cursor-snap.md
 */

import type { Point2D } from '../../rendering/types/Types';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';
import { MEMBER_GHOST_LEN_MM } from '../framing/member-column-face-snap';
import type { GhostFaceFrame, MemberGhostSnapResult } from '../framing/linear-member-face-snap';
import type { SceneSnapTargets } from '../framing/scene-snap-targets';
import { resolvePolarDiskSnap, type PolarDiskSnapOptions } from '../columns/polar-disk-snap';
import { resolveRectCartesianSnap } from '../columns/rect-cartesian-snap';

/** Πλησιέστερο magnet hit (σημείο + προαιρετικό R/θ faceFrame + dist για nearest-wins). */
interface MagnetHit {
  readonly position: Point2D;
  readonly faceFrame?: GhostFaceFrame;
  readonly dist: number;
}

/**
 * Magnet placement του START σε πολικό (δίσκος) ή καρτεσιανό (ορθογώνιο) πλέγμα — `null` όταν ο cursor
 * δεν είναι εντός κανενός ή λείπει zoom (`worldPerPixel`). Ο εγκέφαλος το καλεί ως member-fallback.
 */
export function resolveMemberMagnetPlacement(
  cursor: Readonly<Point2D>,
  targets: Readonly<SceneSnapTargets>,
  sceneUnits: SceneUnits,
  opts: Readonly<PolarDiskSnapOptions>,
): MemberGhostSnapResult | null {
  if (!(opts.worldPerPixel > 0)) return null;
  let best: MagnetHit | null = null;
  // §3.13 Polar — δίσκοι (κέντρο / δακτύλιος∩ακτίνα), φέρει R/θ faceFrame για listening dims.
  for (const disk of targets.diskTargets) {
    const r = resolvePolarDiskSnap(cursor, disk, sceneUnits, opts);
    if (r && (!best || r.dist < best.dist)) best = { position: r.position, faceFrame: r.faceFrame, dist: r.dist };
  }
  // §3.15 Cartesian — ορθογώνια (κέντρο / 9-point / grid∩)· τα 4 dx/dy dims χτίζονται στο preview.
  for (const rect of targets.rectTargets) {
    const r = resolveRectCartesianSnap(cursor, rect, sceneUnits, opts);
    if (r && (!best || r.dist < best.dist)) best = { position: r.position, dist: r.dist };
  }
  if (!best) return null;

  const ghostLen = MEMBER_GHOST_LEN_MM * mmToSceneUnits(sceneUnits);
  return {
    start: { x: best.position.x, y: best.position.y },
    end: { x: best.position.x + ghostLen, y: best.position.y },
    status: 'neutral',
    ...(best.faceFrame ? { faceFrame: best.faceFrame } : {}),
  };
}
