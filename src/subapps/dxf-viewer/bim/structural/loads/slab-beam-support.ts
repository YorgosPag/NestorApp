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
import type { BeamEntity, BeamSupportType } from '../../types/beam-types';
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

/** Slab outline → σημεία σε m (ίδιο canvas→m transform με `beamEndpointsM`). Κενό όταν
 *  λείπει το outline (πλάκα χωρίς γεωμετρία → εκτός spatial support detection). */
function slabOutlineM(slab: SlabEntity): Pt2M[] {
  const verts = slab.params.outline?.vertices;
  if (!verts) return [];
  const perScene = mmToSceneUnits(slab.params.sceneUnits ?? 'mm');
  const toM = (canvas: number): number => canvas / perScene / 1000;
  return verts.map((v) => ({ x: toM(v.x), y: toM(v.y) }));
}

/** Επικάλυψη πλάκας↔δοκού: καλυμμένο μήκος (m) + **κάθετο βάθος** (m) στην μακρινή παρειά. */
interface BeamCoverage {
  /** Διαμήκες καλυμμένο μήκος δοκού (m)· 0 = μη-φέρουσα. */
  readonly cov: number;
  /** Κάθετη απόσταση (m) από τον άξονα της δοκού ως την **μακρινή** παρειά της πλάκας
   *  (= μήκος προβόλου όταν η πλάκα είναι ολόκληρη στη μία πλευρά). */
  readonly perpDepthM: number;
}

/**
 * Επικάλυψη μιας πλάκας πάνω σε έναν άξονα δοκού. Φέρουσα (`cov > 0`) μόνο όταν μία παρειά
 * της πλάκας τρέχει πάνω/δίπλα στον άξονα + υπάρχει διαμήκης επικάλυψη. Το `perpDepthM`
 * (μέγιστη κάθετη έκταση) είναι το μήκος προβόλου όταν η πλάκα προεξέχει στη μία πλευρά.
 */
function beamCoverage(slabPtsM: readonly Pt2M[], axis: BeamAxisM): BeamCoverage {
  const p = projectPolygonOnAxis(slabPtsM, axis.ax, axis.ay, axis.ux, axis.uy);
  if (Math.min(Math.abs(p.perpMin), Math.abs(p.perpMax)) > EDGE_TOL_M) return { cov: 0, perpDepthM: 0 };
  const lo = Math.max(p.alongMin, 0);
  const hi = Math.min(p.alongMax, axis.lengthM);
  const cov = hi - lo;
  if (cov <= COVERAGE_EPS_M) return { cov: 0, perpDepthM: 0 };
  return { cov, perpDepthM: Math.max(Math.abs(p.perpMin), Math.abs(p.perpMax)) };
}

/** Φέρουσα δοκός μιας πλάκας: id + καλυμμένο μήκος (m) + κάθετο βάθος (m). */
interface BearingBeam {
  readonly id: string;
  readonly cov: number;
  readonly perpDepthM: number;
}

/** Φέρουσες δοκοί μιας πλάκας + άθροισμα καλυμμένων μηκών. */
function bearingBeams(
  slabPtsM: readonly Pt2M[],
  axes: readonly BeamAxisM[],
): { covered: BearingBeam[]; totalCov: number } {
  const covered: BearingBeam[] = [];
  let totalCov = 0;
  for (const axis of axes) {
    const { cov, perpDepthM } = beamCoverage(slabPtsM, axis);
    if (cov > 0) {
      covered.push({ id: axis.id, cov, perpDepthM });
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

// ─── ADR-498 — Topology-aware slab support condition (mirror ADR-486 δοκαριού) ───

/**
 * DERIVED συνθήκη στήριξης μιας πλάκας από τη ζωντανή τοπολογία (spatial, αφού οι πλάκες
 * ΔΕΝ είναι κόμβοι του structural graph). Mirror του beam `BeamSupportCondition`.
 */
export interface SlabSupportCondition {
  /** Τύπος στήριξης που οδηγεί ροπή/οπλισμό ΤΩΡΑ: 'cantilever' όταν ακριβώς 1 φέρουσα δοκός. */
  readonly supportType: BeamSupportType;
  /** Πλήθος φερουσών δοκών (0=αιωρούμενη, 1=πρόβολος, 2+=αμφιέρειστη/πολλαπλή). */
  readonly supportCount: number;
  /** Μήκος προβόλου (m) = κάθετη προβολή ως την ελεύθερη παρειά· 0 όταν δεν είναι πρόβολος. */
  readonly cantileverLengthM: number;
  /**
   * ADR-499 §C — η μοναδική **φέρουσα δοκός** όταν `supportType==='cantilever'` (το hogging
   * της προβόλου-πλάκας τη φορτίζει στρεπτικά). Absent όταν δεν είναι πρόβολος. Additive.
   */
  readonly bearingBeamId?: string;
  /**
   * ADR-499 §C — διαμήκες καλυμμένο μήκος (m) της δοκού από την πλάκα-πρόβολο = το μήκος
   * πάνω στο οποίο δρα ο κατανεμημένος στρεπτικός φόρτος `t_Ed`. Absent όταν δεν είναι πρόβολος.
   */
  readonly coverageLengthM?: number;
}

/**
 * Συνθήκη στήριξης μιας πλάκας από τις φέρουσες δοκούς της. **Συντηρητικό (mirror ADR-486):**
 * μόνο «ακριβώς 1 φέρουσα δοκός» → 'cantilever' (το μήκος προβόλου = η κάθετη προβολή στη μακρινή
 * παρειά). 0 ή 2+ → 'simple' (αιωρούμενη καλύπτεται από diagnostics· 2+ = αμφιέρειστη, μηδέν
 * regression). Συνέχεια/two-way = DEFER.
 */
function slabSupportCondition(slabPtsM: readonly Pt2M[], axes: readonly BeamAxisM[]): SlabSupportCondition {
  const { covered } = bearingBeams(slabPtsM, axes);
  if (covered.length === 1) {
    return {
      supportType: 'cantilever',
      supportCount: 1,
      cantileverLengthM: covered[0].perpDepthM,
      bearingBeamId: covered[0].id,
      coverageLengthM: covered[0].cov,
    };
  }
  return { supportType: 'simple', supportCount: covered.length, cantileverLengthM: 0 };
}

/**
 * ADR-498 — `Map<slabId → SlabSupportCondition>` για ΟΛΕΣ τις πλάκες της σκηνής. Mirror του
 * `buildBeamSupportTypeMap` (ADR-486) αλλά **entity-based** (spatial), αφού οι πλάκες δεν
 * ζουν στον graph. Reuse του ΙΔΙΟΥ `bearingBeams` — μηδέν διπλότυπη geometry. Κενό χωρίς πλάκες/δοκούς.
 */
export function computeSlabSupportConditions(
  entities: readonly Entity[],
): Map<string, SlabSupportCondition> {
  const out = new Map<string, SlabSupportCondition>();
  const slabs = entities.filter(isSlabEntity);
  if (slabs.length === 0) return out;
  const axes = entities
    .filter(isBeamEntity)
    .map(beamAxisM)
    .filter((a): a is BeamAxisM => a !== null);

  for (const slab of slabs) {
    const ptsM = slabOutlineM(slab);
    if (ptsM.length < 3) continue;
    out.set(slab.id, slabSupportCondition(ptsM, axes));
  }
  return out;
}
