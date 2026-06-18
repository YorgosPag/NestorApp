/**
 * Slab → δοκός tributary — pure SSoT (ADR-495, **mirror του ADR-478** `wall-beam-support`).
 *
 * Αντιστοιχεί κάθε πλάκα στη(ις) φέρουσα(ες) δοκό(ούς) που την κρατά και κατανέμει το
 * **εμβαδό ευθύνης** της (m²) σε αυτές, ώστε το `load-path-takedown` να φορτίσει τη δοκό
 * με το πραγματικό φορτίο της πλάκας (G/Q area-loads → UDL → M_Ed → οπλισμός/sizing/
 * διαγράμματα/FEM) **αντί** του column-grid proxy. Λύνει το bug «προσθήκη πλάκας/προβόλου
 * δεν αλλάζει τα διαγράμματα» (η δοκός έπαιρνε φορτίο μόνο από το grid spacing, slab-agnostic).
 *
 * **Ποια δοκός;** καθαρά **spatial** — η `SlabEntity` ΔΕΝ έχει `attachBaseToIds` (μόνο
 * `outline` polygon). Μια δοκός είναι φέρουσα όταν μία παρειά της πλάκας τρέχει **κατά
 * μήκος** του άξονά της (ελάχιστη κάθετη απόσταση ≤ `EDGE_TOL_M`) με διαμήκη επικάλυψη.
 * Πιάνει **πρόβολο** (πλάκα ολόκληρη στη μία πλευρά, 1 φέρουσα δοκός → 100%) ΚΑΙ **αμφιέρειστη**
 * πλάκα (2 παράλληλες δοκοί → 50/50).
 *
 * **Διατήρηση φορτίου (μηδέν double/under-count):** όλο το εμβαδό της πλάκας μοιράζεται
 * στις φέρουσες δοκούς **κατά μήκος-κάλυψης** (`area × Lcov / ΣLcov`). Reuse:
 *   · `projectPolygonOnAxis` (ADR-494) — slab outline → beam axis (along + signed perp).
 *   · `beamEndpointsM` — άξονας δοκού σε m.
 *   · `slab.geometry.netArea/area` — το διατηρούμενο σύνολο (ήδη m², trusted).
 *
 * Pure — zero React/DOM/Firestore. Μονάδες: μήκη m, εμβαδά m².
 * DEFER (slice 2): πρόβολος-moment (cantilever hogging) · πραγματικά two-way/interior
 * δοκοί (slab straddle με αμφότερες πλευρές βαθιές) · slab→column-N/footing.
 *
 * @see ./wall-beam-support.ts — το πρότυπο (τοίχος→δοκός γραμμικό φορτίο)
 * @see ../../geometry/shared/polygon-axis-projection.ts — `projectPolygonOnAxis` (ADR-494)
 * @see ./load-path-takedown.ts — ο καταναλωτής (`beamLoad` tributaryAreaM2)
 * @see docs/centralized-systems/reference/adrs/ADR-495-slab-beam-load-propagation.md
 */

import type { Entity } from '../../../types/entities';
import { isSlabEntity, isBeamEntity } from '../../../types/entities';
import type { SlabEntity } from '../../types/slab-types';
import type { BeamEntity } from '../../types/beam-types';
import { projectPolygonOnAxis } from '../../geometry/shared/polygon-axis-projection';
import { beamEndpointsM } from './member-load-geometry';
import { mmToSceneUnits } from '../../../utils/scene-units';

/** m — μία παρειά της πλάκας θεωρείται «κατά μήκος» της δοκού όταν η ελάχιστη κάθετη απόσταση ≤ αυτό. */
const EDGE_TOL_M = 0.15;

/** m — ελάχιστη διαμήκης επικάλυψη/μήκος δοκού ώστε να θεωρηθεί φέρουσα (κάτω = αριθμητικό noise). */
const COVERAGE_EPS_M = 0.05;

/** Ελάχιστο 2D σημείο (plan space, m). */
interface Pt2M {
  readonly x: number;
  readonly y: number;
}

/** Άξονας δοκού σε m + μοναδιαία διεύθυνση + μήκος. */
interface BeamAxisM {
  readonly id: string;
  readonly ax: number;
  readonly ay: number;
  readonly ux: number;
  readonly uy: number;
  readonly lengthM: number;
}

/** Beam axis (m) + μοναδιαία διεύθυνση· `null` αν εκφυλισμένο (μηδενικό μήκος). */
function beamAxisM(b: BeamEntity): BeamAxisM | null {
  const { start, end } = beamEndpointsM(b);
  const dx = end.xM - start.xM;
  const dy = end.yM - start.yM;
  const len = Math.hypot(dx, dy);
  if (len < COVERAGE_EPS_M) return null;
  return { id: b.id, ax: start.xM, ay: start.yM, ux: dx / len, uy: dy / len, lengthM: len };
}

/** Slab outline → σημεία σε m (ίδιο canvas→m transform με `beamEndpointsM`). */
function slabOutlineM(slab: SlabEntity): Pt2M[] {
  const perScene = mmToSceneUnits(slab.params.sceneUnits ?? 'mm');
  const toM = (canvas: number): number => canvas / perScene / 1000;
  return slab.params.outline.vertices.map((v) => ({ x: toM(v.x), y: toM(v.y) }));
}

/**
 * Καλυμμένο μήκος δοκού (m) όπου η πλάκα την κρατά. 0 όταν η πλάκα δεν ακουμπά τον άξονα
 * (καμία παρειά κατά μήκος) ή δεν υπάρχει διαμήκης επικάλυψη.
 */
function coveredBeamLengthM(slabPtsM: readonly Pt2M[], axis: BeamAxisM): number {
  const p = projectPolygonOnAxis(slabPtsM, axis.ax, axis.ay, axis.ux, axis.uy);
  // Φέρουσα μόνο όταν μία παρειά της πλάκας τρέχει πάνω/δίπλα στον άξονα της δοκού.
  if (Math.min(Math.abs(p.perpMin), Math.abs(p.perpMax)) > EDGE_TOL_M) return 0;
  const lo = Math.max(p.alongMin, 0);
  const hi = Math.min(p.alongMax, axis.lengthM);
  const cov = hi - lo;
  return cov > COVERAGE_EPS_M ? cov : 0;
}

/** Φέρουσες δοκοί μιας πλάκας + καλυμμένο μήκος (m) η καθεμία. */
function bearingBeams(
  slabPtsM: readonly Pt2M[],
  axes: readonly BeamAxisM[],
): { covered: Array<{ id: string; cov: number }>; totalCov: number } {
  const covered: Array<{ id: string; cov: number }> = [];
  let totalCov = 0;
  for (const axis of axes) {
    const cov = coveredBeamLengthM(slabPtsM, axis);
    if (cov > 0) {
      covered.push({ id: axis.id, cov });
      totalCov += cov;
    }
  }
  return { covered, totalCov };
}

/**
 * ADR-495 — εμβαδό ευθύνης πλάκας (m²) ανά δοκό από τις πλάκες που εδράζονται/κολλάνε
 * επάνω της. ΕΝΑ pass για όλη τη σκηνή. Κενό όταν λείπουν πλάκες/δοκοί. Το αποτέλεσμα
 * αντικαθιστά το column-grid proxy στο `beamLoad` (slab-aware υπερισχύει· fallback grid).
 */
export function computeSlabBeamTributary(entities: readonly Entity[]): Map<string, number> {
  const out = new Map<string, number>();
  const beams = entities.filter(isBeamEntity);
  if (beams.length === 0) return out;
  const slabs = entities.filter(isSlabEntity);
  if (slabs.length === 0) return out;

  const axes = beams
    .map(beamAxisM)
    .filter((a): a is BeamAxisM => a !== null);
  if (axes.length === 0) return out;

  for (const slab of slabs) {
    const areaM2 = slab.geometry?.netArea ?? slab.geometry?.area ?? 0;
    if (!(areaM2 > 0)) continue;
    const ptsM = slabOutlineM(slab);
    if (ptsM.length < 3) continue;

    const { covered, totalCov } = bearingBeams(ptsM, axes);
    if (totalCov <= 0) continue;

    // Διατήρηση: όλο το εμβαδό μοιράζεται στις φέρουσες δοκούς κατά μήκος-κάλυψης.
    for (const { id, cov } of covered) {
      out.set(id, (out.get(id) ?? 0) + areaM2 * (cov / totalCov));
    }
  }
  return out;
}
