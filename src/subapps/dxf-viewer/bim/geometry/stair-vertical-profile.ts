/**
 * Stair Top/Base vertical-extent resolver (ADR-401 Phase G) — SSoT.
 *
 * ΕΝΑΣ pure resolver για το **κατακόρυφο εύρος** μιας BIM σκάλας όταν η κορυφή ή/και
 * η βάση της είναι `attached` σε δομικό host (πλάκα/δοκάρι/landing). Mirror του
 * `column-vertical-profile.ts`, αλλά με **stair semantics**:
 *
 *   - **top** (`topBinding='attached'`): η σκάλα ανεβαίνει μέχρι να συναντήσει την
 *     **χαμηλότερη κάτω-παρειά** (lower-envelope) host που καλύπτει το σημείο άφιξης
 *     (top of run) → ΔΕΝ διαπερνά (Revit «Attach Top»). Το νέο `totalRise = top −
 *     base` αναλύεται σε **ακέραια σκαλοπάτια**: `stepCount = round(totalRise /
 *     rise)`, `rise' = totalRise / stepCount` (Revit «Desired number of risers» —
 *     ίσα risers, ακριβής συνάντηση επιπέδου).
 *   - **base** (`baseBinding='attached'`): η βάση «κάθεται» στην **ψηλότερη
 *     άνω-παρειά** (upper-envelope) host που καλύπτει το σημείο βάσης (πλάκα/
 *     πεδιλοδοκός από κάτω). Ακάλυπτη → nominal base.
 *
 * Σε αντίθεση με την κολώνα (axis-less, per-corner), η σκάλα έχει **run-άξονα**:
 * αποτιμούμε τη δομική παρειά σε λίγα αντιπροσωπευτικά plan-points (κέντρο + γωνίες
 * πλάτους) στο πάνω άκρο (top) και στο κάτω άκρο (base) του run.
 *
 * REUSE (SSoT, N.0.2): `HostFootprintInput` + `hostUndersideAt`/`hostTopsideAt`/
 * `collectHostFootprints`/`makeHostFootprintResolver` (`host-footprint-eval.ts`) —
 * τα ΙΔΙΑ που τρώει η κολώνα. `directionToUnitVector`/`perp` (stair geometry SSoT).
 * Κανένα διπλό formula κάτω/άνω-παρειάς.
 *
 * Convention μονάδων: `basePoint` + host footprints στο **ίδιο** plan space (mm).
 * Τα `z*mm` είναι απόλυτα mm από project origin (ADR-369 §2 datum).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-401-bim-wall-top-base-constraints-attach-to-structural.md §5 (Phase G)
 * @see bim/geometry/column-vertical-profile.ts — ο δίδυμος της κολώνας
 * @see bim/geometry/host-footprint-eval.ts — shared point-based host evaluation
 */

import type { Point3D } from '../types/stair-types';
import type { StairTopBinding, StairBaseBinding } from '../types/bim-binding';
import type { EntityAttachSide } from '../entities/entity-attach-detach';
import { directionToUnitVector, perp } from './stairs/stair-geometry-shared';
import type { HostFootprintInput, Pt2 } from './wall-host-plan-builder';
import {
  HOST_Z_EPS,
  hostUndersideAt,
  hostTopsideAt,
  collectHostFootprints,
  makeHostFootprintResolver,
} from './host-footprint-eval';

/** Δομικό υποσύνολο των StairParams που χρειάζεται ο resolver (StairParams assignable). */
export interface StairVerticalParams {
  readonly basePoint: Point3D;
  readonly direction: number; // deg, 0 = +X
  readonly totalRun: number; // mm (κατά μήκος του run)
  readonly width: number; // mm
  readonly rise: number; // mm — nominal ύψος σκαλοπατιού
  readonly stepCount: number; // nominal
  readonly totalRise: number; // mm — nominal (rise × stepCount)
  readonly topBinding?: StairTopBinding;
  readonly baseBinding?: StairBaseBinding;
  readonly attachTopToIds?: readonly string[];
  readonly attachBaseToIds?: readonly string[];
}

/** Context — lookup host inputs ανά id (mirror ColumnVerticalContext). */
export interface StairVerticalContext {
  /** Lookup host footprint-input ανά id (top + base attach). */
  readonly resolveHostInput?: (id: string) => HostFootprintInput | null;
}

/** Αποτέλεσμα resolver — resolved κατακόρυφο εύρος + ακέραια σκαλοπάτια. */
export interface StairVerticalProfile {
  /** Απόλυτο Z βάσης (mm) — resolved (host top-face αν base attached). */
  readonly baseZmm: number;
  /** Απόλυτο Z κορυφής/άφιξης (mm) — resolved (host underside αν top attached). */
  readonly topZmm: number;
  /** Συνολική άνοδος (mm) = `topZmm − baseZmm` (ακριβής συνάντηση host). */
  readonly totalRise: number;
  /** Αριθμός σκαλοπατιών (whole-step snap όταν attached). */
  readonly stepCount: number;
  /** Ύψος σκαλοπατιού (mm) = `totalRise / stepCount` (ίσα risers). */
  readonly rise: number;
  /** True αν η κορυφή πήρε host underside. */
  readonly topHasAttach: boolean;
  /** True αν η βάση πήρε host top-face. */
  readonly baseHasAttach: boolean;
  /**
   * True αν ζητήθηκε attach αλλά το host εύρος ήταν εκφυλισμένο (top ≤ base) →
   * fallback στα nominal σκαλοπάτια (warning στον caller, ΟΧΙ crash).
   */
  readonly degenerate: boolean;
  /** Hosts που ζητήθηκαν αλλά λείπουν (σβήστηκαν) → fallback + warning. */
  readonly missingHostIds: readonly string[];
}

// ─── Whole-step snap SSoT (Revit «Desired number of risers» — ίσα risers) ─────

/** Αποτέλεσμα whole-step snap: ακέραια σκαλοπάτια που γεμίζουν ακριβώς το `totalRise`. */
export interface WholeStepSnap {
  readonly stepCount: number;
  readonly rise: number;
  readonly totalRise: number;
}

/**
 * Whole-step snap SSoT: δοθέντος ενός raw `totalRise` (mm) και του nominal ύψους
 * βαθμίδας, βρες τα ΑΚΕΡΑΙΑ σκαλοπάτια που το γεμίζουν με ίσα risers (Revit
 * «Desired number of risers»): `stepCount = round(totalRise / nominalRise)`,
 * `rise' = totalRise / stepCount`. ΕΝΑΣ τόπος για τη φόρμουλα — την καλούν τόσο ο
 * attach resolver (παρακάτω) όσο και το 3D κάθετο grip (`bim3d-resize-bridge`).
 */
export function snapTotalRiseToWholeSteps(totalRiseRaw: number, nominalRise: number): WholeStepSnap {
  const stepCount = Math.max(1, Math.round(totalRiseRaw / nominalRise));
  return { stepCount, rise: totalRiseRaw / stepCount, totalRise: totalRiseRaw };
}

// ─── Plan sample points (κέντρο + γωνίες πλάτους στα άκρα του run) ─────────────

function topSamples(p: StairVerticalParams): Pt2[] {
  const u = directionToUnitVector(p.direction);
  const q = perp(u);
  const cx = p.basePoint.x + u.x * p.totalRun;
  const cy = p.basePoint.y + u.y * p.totalRun;
  const half = p.width / 2;
  return [
    { x: cx, y: cy },
    { x: cx + q.x * half, y: cy + q.y * half },
    { x: cx - q.x * half, y: cy - q.y * half },
  ];
}

function baseSamples(p: StairVerticalParams): Pt2[] {
  const u = directionToUnitVector(p.direction);
  const q = perp(u);
  const cx = p.basePoint.x;
  const cy = p.basePoint.y;
  const half = p.width / 2;
  return [
    { x: cx, y: cy },
    { x: cx + q.x * half, y: cy + q.y * half },
    { x: cx - q.x * half, y: cy - q.y * half },
  ];
}

/**
 * Public plan-sample SSoT για auto-attach detection (ADR-401 Phase G.3). Δίνει τα
 * ίδια αντιπροσωπευτικά plan-points (κέντρο + γωνίες πλάτους) στο πάνω άκρο
 * (`side='top'`) ή στο κάτω άκρο (`side='base'`) του run που χρησιμοποιεί ο resolver
 * — ώστε ο coordinator να ελέγχει host coverage με ΤΗΝ ΙΔΙΑ γεωμετρία.
 */
export function stairPlanSamples(p: StairVerticalParams, side: EntityAttachSide): Pt2[] {
  return side === 'top' ? topSamples(p) : baseSamples(p);
}

// ─── Base resolution (upper-envelope: ψηλότερη άνω-παρειά) ────────────────────

/**
 * Απόλυτο Z βάσης σκάλας (mm). Nominal = `basePoint.z`. `baseBinding='attached'`
 * → η ψηλότερη host top-face που καλύπτει κάποιο base sample-point (η βάση κάθεται
 * πάνω στο υψηλότερο στήριγμα). Ακάλυπτη → nominal.
 */
export function resolveStairBaseZmm(
  params: StairVerticalParams,
  ctx: StairVerticalContext,
): { baseZmm: number; hasAttach: boolean; missingHostIds: string[] } {
  const nominal = params.basePoint.z;
  const ids = params.attachBaseToIds ?? [];
  if (params.baseBinding !== 'attached' || ids.length === 0) {
    return { baseZmm: nominal, hasAttach: false, missingHostIds: [] };
  }
  const { hosts, missingHostIds } = collectHostFootprints(ids, ctx.resolveHostInput);
  const samples = baseSamples(params);
  let best: number | null = null;
  for (const pt of samples) {
    for (const h of hosts) {
      const z = hostTopsideAt(h, pt);
      if (z !== null && (best === null || z > best + HOST_Z_EPS)) best = z;
    }
  }
  return best === null
    ? { baseZmm: nominal, hasAttach: false, missingHostIds }
    : { baseZmm: best, hasAttach: true, missingHostIds };
}

// ─── Top resolution (lower-envelope: χαμηλότερη κάτω-παρειά, unbounded) ────────

/**
 * Απόλυτο Z κορυφής/άφιξης σκάλας (mm). Nominal = `baseZmm + rise × stepCount`.
 * `topBinding='attached'` → η **χαμηλότερη** host κάτω-παρειά που καλύπτει κάποιο
 * top sample-point (η σκάλα σταματά στο πρώτο ταβάνι/δοκάρι, ΔΕΝ διαπερνά· μπορεί
 * να είναι ψηλότερα Ή χαμηλότερα από το nominal — Revit attach-top). Ακάλυπτη →
 * nominal.
 */
export function resolveStairTopZmm(
  params: StairVerticalParams,
  baseZmm: number,
  ctx: StairVerticalContext,
): { topZmm: number; hasAttach: boolean; missingHostIds: string[] } {
  const nominal = baseZmm + params.rise * params.stepCount;
  const ids = params.attachTopToIds ?? [];
  if (params.topBinding !== 'attached' || ids.length === 0) {
    return { topZmm: nominal, hasAttach: false, missingHostIds: [] };
  }
  const { hosts, missingHostIds } = collectHostFootprints(ids, ctx.resolveHostInput);
  const samples = topSamples(params);
  let best: number | null = null;
  for (const pt of samples) {
    for (const h of hosts) {
      const z = hostUndersideAt(h, pt);
      if (z !== null && (best === null || z < best - HOST_Z_EPS)) best = z;
    }
  }
  return best === null
    ? { topZmm: nominal, hasAttach: false, missingHostIds }
    : { topZmm: best, hasAttach: true, missingHostIds };
}

// ─── Combined profile (+ whole-step snap) ─────────────────────────────────────

/**
 * Resolver SSoT — πλήρες κατακόρυφο προφίλ σκάλας. Resolve base (upper-envelope)
 * → top (lower-envelope) → όταν υπάρχει attach, **whole-step snap** του νέου
 * `totalRise` σε ακέραια σκαλοπάτια. Μη-attached → byte-for-byte τα nominal
 * `rise`/`stepCount`/`totalRise` (fast path, καμία αλλαγή στην ίσια σκάλα).
 */
export function resolveStairVerticalProfile(
  params: StairVerticalParams,
  ctx: StairVerticalContext,
): StairVerticalProfile {
  const base = resolveStairBaseZmm(params, ctx);
  const top = resolveStairTopZmm(params, base.baseZmm, ctx);
  const missingHostIds = [...base.missingHostIds, ...top.missingHostIds];

  // Καμία attach → fast path (nominal σκαλοπάτια, ίσια σκάλα).
  if (!base.hasAttach && !top.hasAttach) {
    return {
      baseZmm: base.baseZmm,
      topZmm: top.topZmm,
      totalRise: params.totalRise,
      stepCount: params.stepCount,
      rise: params.rise,
      topHasAttach: false,
      baseHasAttach: false,
      degenerate: false,
      missingHostIds,
    };
  }

  const totalRiseRaw = top.topZmm - base.baseZmm;

  // Εκφυλισμένο host εύρος (top ≤ base, ή μη-θετικό nominal rise) → fallback στα
  // nominal σκαλοπάτια, κράτα το resolved base, flag degenerate.
  if (!Number.isFinite(totalRiseRaw) || totalRiseRaw <= HOST_Z_EPS || params.rise <= 0) {
    return {
      baseZmm: base.baseZmm,
      topZmm: base.baseZmm + params.rise * params.stepCount,
      totalRise: params.totalRise,
      stepCount: params.stepCount,
      rise: params.rise,
      topHasAttach: top.hasAttach,
      baseHasAttach: base.hasAttach,
      degenerate: true,
      missingHostIds,
    };
  }

  // Whole-step snap (Revit ίσα risers): ακέραια σκαλοπάτια, ακριβής συνάντηση top.
  const snap = snapTotalRiseToWholeSteps(totalRiseRaw, params.rise);

  return {
    baseZmm: base.baseZmm,
    topZmm: top.topZmm,
    totalRise: snap.totalRise,
    stepCount: snap.stepCount,
    rise: snap.rise,
    topHasAttach: top.hasAttach,
    baseHasAttach: base.hasAttach,
    degenerate: false,
    missingHostIds,
  };
}

/**
 * Convenience: lookup builder από host inputs (alias του shared SSoT).
 * ΕΝΑΣ τόπος για το `Map<id, HostFootprintInput>` που τρώει ο resolver (mirror
 * `makeColumnHostResolver`).
 */
export const makeStairHostResolver = makeHostFootprintResolver;
