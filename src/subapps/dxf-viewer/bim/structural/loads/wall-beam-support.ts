/**
 * Wall → δοκός φορτίο στήριξης — pure SSoT (ADR-478, T1).
 *
 * Αντιστοιχεί κάθε τοίχο τοιχοποιίας στη(ις) φέρουσα(ες) δοκό(ούς) που πατάει και
 * αθροίζει το γραμμικό φορτίο του ως **πρόσθετο μόνιμο αξονικό (kN)** ανά δοκό:
 *
 *   contribution[beam] (kN) = g_wall[kN/m] · καλυμμένο μήκος δοκού[m]
 *
 * Το `load-path-takedown` αποθηκεύει το φορτίο δοκού ως ισοδύναμο αξονικό (kN) και
 * το smear-άρει σε UDL (w_Ed = W_Ed/L → M_Ed) — άρα η συνεισφορά τοίχου ρέει αυτόματα
 * σε οπλισμό (ADR-472) & διαστασιολόγηση ύψους (ADR-475). Μηδέν αλλαγή στο μοντέλο
 * φορτίου.
 *
 * **Ποια δοκός;** (1) explicit FK: όταν ο τοίχος έχει `baseBinding='attached'`, μόνο
 * οι δοκοί του `attachBaseToIds` (ADR-401). (2) spatial fallback: αλλιώς όποια δοκός
 * το footprint της καλύπτει τμήμα του άξονα τοίχου (`coveredIntervals` SSoT). Το
 * **καλυμμένο μήκος** προκύπτει πάντα από τη γεωμετρική επικάλυψη (t-intervals × μήκος).
 *
 * Pure — zero React/DOM/Firestore. Μονάδες: φορτία kN, μήκη m (output).
 *
 * @see ./wall-line-loads.ts — g_wall (kN/m) από γεωμετρία+υλικό
 * @see ../../geometry/shared/segment-polygon-coverage.ts — `coveredIntervals` SSoT
 * @see ./load-path-takedown.ts — ο καταναλωτής (beamLoad extraDeadAxialKn)
 * @see docs/centralized-systems/reference/adrs/ADR-478-wall-line-loads.md
 */

import type { Entity } from '../../../types/entities';
import { isWallEntity, isBeamEntity } from '../../../types/entities';
import type { WallEntity } from '../../types/wall-types';
import type { BeamEntity } from '../../types/beam-types';
import { coveredIntervals, type Pt2 } from '../../geometry/shared/segment-polygon-coverage';
import { beamHostInput } from '../../geometry/wall-host-plan-builder';
import { isMasonryLineLoadCandidate, resolveEffectiveWallLineLoad } from './wall-line-loads';

/** Καλυμμένο μήκος (m) μιας δοκού κάτω από τον άξονα του τοίχου (γεωμετρική επικάλυψη). */
function coveredBeamLengthM(
  start: Pt2,
  end: Pt2,
  wallLengthM: number,
  beam: BeamEntity,
  explicitIds: readonly string[] | undefined,
): number {
  // explicit FK present → μόνο οι δηλωμένες δοκοί στηρίζουν τον τοίχο.
  if (explicitIds && !explicitIds.includes(beam.id)) return 0;
  const footprint = beamHostInput(beam).footprint;
  let coveredT = 0;
  for (const [t0, t1] of coveredIntervals(start, end, footprint)) {
    coveredT += Math.max(0, t1 - t0);
  }
  return coveredT * wallLengthM;
}

/** Συνεισφορά ενός τοίχου (kN ανά beamId) — κενό αν δεν είναι τοιχοποιία/μηδέν φορτίο. */
function wallContributionKn(wall: WallEntity, beams: readonly BeamEntity[]): Map<string, number> {
  const out = new Map<string, number>();
  if (!isMasonryLineLoadCandidate(wall.params)) return out;
  const { deadLineLoadKnm } = resolveEffectiveWallLineLoad({ params: wall.params });
  const wallLengthM = wall.geometry?.length ?? 0;
  if (deadLineLoadKnm <= 0 || wallLengthM <= 0) return out;

  const start: Pt2 = { x: wall.params.start.x, y: wall.params.start.y };
  const end: Pt2 = { x: wall.params.end.x, y: wall.params.end.y };
  const explicitIds =
    wall.params.baseBinding === 'attached' ? wall.params.attachBaseToIds : undefined;

  for (const beam of beams) {
    const coveredM = coveredBeamLengthM(start, end, wallLengthM, beam, explicitIds);
    if (coveredM > 0) out.set(beam.id, (out.get(beam.id) ?? 0) + deadLineLoadKnm * coveredM);
  }
  return out;
}

/**
 * ADR-478 — πρόσθετο μόνιμο αξονικό φορτίο (kN) ανά δοκό από τις τοιχοποιίες που
 * πατούν επάνω της. ΕΝΑ pass για όλη τη σκηνή. Κενό όταν λείπουν τοίχοι/δοκοί.
 */
export function computeWallBeamDeadLoads(entities: readonly Entity[]): Map<string, number> {
  const out = new Map<string, number>();
  const beams = entities.filter(isBeamEntity);
  if (beams.length === 0) return out;
  const walls = entities.filter(isWallEntity);
  if (walls.length === 0) return out;

  for (const wall of walls) {
    for (const [beamId, kn] of wallContributionKn(wall, beams)) {
      out.set(beamId, (out.get(beamId) ?? 0) + kn);
    }
  }
  return out;
}
