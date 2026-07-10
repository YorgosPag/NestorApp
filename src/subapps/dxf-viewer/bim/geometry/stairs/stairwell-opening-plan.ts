/**
 * ADR-632 — Φάση 3: `StairwellOpeningEngine` (καθαρός πυρήνας — planner).
 *
 * ΕΝΩΝΕΙ τα «τούβλα» Φ1–Φ2 σε έναν **derived-cascade planner**: δοθέντων των
 * σκαλών (footprint + κατακόρυφο προφίλ + treads + nosings σε mm), των υπερκείμενων
 * πλακών, και των ήδη-υπαρχόντων auto-openings, παράγει ένα **diff plan**
 * (creates / updates / deletes) ώστε να υπάρχει ΑΚΡΙΒΩΣ ένα managed «well» opening
 * ανά ζεύγος (σκάλα, πλάκα) όπου το ελεύθερο ύψος πέφτει κάτω από το νόμιμο ελάχιστο.
 *
 * Σε αντίθεση με τα υπάρχοντα cascades (`wall-opening-coordinator`,
 * `cascade-transformed-slab-openings`) που ΜΟΝΟ ξανα-υπολογίζουν geometry
 * υπαρχόντων openings, αυτός ο engine κάνει **lifecycle** (δημιουργεί/σβήνει) —
 * τα stairwell openings είναι derived οντότητες, όπως τα floor openings στο Revit /
 * ArchiCAD (associative, regenerate-on-host-change). Το apply (scene mutation +
 * enterprise-id + persistence) ζει στον thin coordinator (`stairwell-opening-coordinator`).
 *
 * **Idempotent (N.7.2 Q3):** key = `autoStairId + slabId`. Ξανα-run με το ίδιο
 * scene → μηδέν creates/updates/deletes (το outline δεν άλλαξε → κανένα churn).
 *
 * **Pure** — μηδέν scene / entities / React / IO. x/y στις μονάδες σκηνής· z
 * (nosings, slab underside) σε απόλυτα mm (ο coordinator κάνει τη μετατροπή ΜΙΑ φορά).
 *
 * REUSE (SSoT, N.0.2): `findSlabsAboveStair` (Φ2), `evaluateStairHeadroom` +
 * `expandViolatingRange` (Φ1), `computeStairwellOpeningOutline` (Φ1),
 * `STAIRWELL_OPENING_MARGIN_TREADS` (config). Καμία διπλή γεωμετρία/κατώφλι.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-632-stairwell-auto-opening-ssot.md §3
 * @see bim/walls/wall-opening-coordinator.ts — το pattern coordinator που mirror-άρει ο coordinator
 */

import type { Polygon3D } from '../../types/bim-base';
import {
  findSlabsAboveStair,
  type StairFootprintInput,
  type StairSlabOverlap,
  type StairSlabOverlapOptions,
  type StairwellSlabCandidate,
} from './stair-slab-overlap';
import {
  evaluateStairHeadroom,
  expandViolatingRange,
  type TreadNosingZ,
} from './stairwell-headroom';
import { computeStairwellOpeningOutline } from './stairwell-opening-outline';
import { STAIRWELL_OPENING_MARGIN_TREADS } from './stairwell-opening-config';

// ─── Inputs ──────────────────────────────────────────────────────────────────

/**
 * Μία σκάλα, ήδη-resolved για τον planner: footprint κάτοψης (overlap), κατακόρυφο
 * προφίλ (mm), tread polygons (μονάδες σκηνής) + per-tread nosing z (mm), και το
 * ελάχιστο ελεύθερο ύψος (mm) του κανονισμού της. Τα `nosingsZmm[k].treadIndex`
 * δείχνουν θέση στον `treads[]`.
 */
export interface StairwellPlanStair {
  readonly stairId: string;
  /** Footprint κάτοψης (μονάδες σκηνής) — coarse overlap gate. */
  readonly footprint: Polygon3D;
  /** Απόλυτο Z βάσης (mm) — `resolveStairVerticalProfile.baseZmm`. */
  readonly baseZmm: number;
  /** Απόλυτο Z κορυφής (mm) — `resolveStairVerticalProfile.topZmm`. */
  readonly topZmm: number;
  /** Tread polygons (μονάδες σκηνής, x/y) — προβάλλονται για το outline. */
  readonly treads: readonly Polygon3D[];
  /** Ύψος μύτης ανά σκαλοπάτι σε απόλυτα mm (converted από τον coordinator). */
  readonly nosingsZmm: readonly TreadNosingZ[];
  /** Ελάχιστο ελεύθερο ύψος (mm) — `effectiveMinHeadroomMm(codeProfile)`. */
  readonly minHeadroomMm: number;
}

/** Ήδη-υπάρχον auto («well») opening στη σκηνή — υποψήφιο για update/delete. */
export interface StairwellManagedOpening {
  readonly openingId: string;
  readonly autoStairId: string;
  readonly slabId: string;
  readonly outline: Polygon3D;
}

// ─── Plan ────────────────────────────────────────────────────────────────────

/** Επιθυμητό opening (create ή update target) για ένα ζεύγος σκάλα↔πλάκα. */
export interface StairwellDesiredOpening {
  readonly autoStairId: string;
  readonly slabId: string;
  readonly outline: Polygon3D;
  /** Εμβαδόν τρύπας (μονάδες σκηνής², unsigned) — diagnostics/ordering. */
  readonly areaSceneUnits2: number;
}

/** Diff plan: τι να δημιουργηθεί / ενημερωθεί / σβηστεί (managed openings μόνο). */
export interface StairwellOpeningPlan {
  readonly creates: readonly StairwellDesiredOpening[];
  readonly updates: readonly { readonly openingId: string; readonly outline: Polygon3D }[];
  readonly deletes: readonly { readonly openingId: string }[];
}

export interface StairwellPlanOptions extends StairSlabOverlapOptions {
  /** Περιθώριο σκαλοπατιών κάτω από την παραβατική ζώνη. Default config value. */
  readonly marginTreads?: number;
  /** Ανοχή (μονάδες σκηνής) για «ίδιο outline» → skip update. Default 1e-6. */
  readonly outlineEps?: number;
}

const DEFAULT_OUTLINE_EPS = 1e-6;

/**
 * Σταθερό key/identity ενός managed opening: ένα ανά (σκάλα, πλάκα). SSoT — το ίδιο
 * string χρησιμεύει και ως **seed** για το deterministic-stable doc id (ADR-632 Φ5:
 * `generateDeterministicSlabOpeningId`), ώστε undo→redo να παράγει το ΙΔΙΟ id.
 */
export function stairwellOpeningPairKey(autoStairId: string, slabId: string): string {
  return `${autoStairId}::${slabId}`;
}

// ─── Desired-set computation ─────────────────────────────────────────────────

/**
 * Το επιθυμητό opening για ένα ζεύγος σκάλα↔πλάκα, ή `null` αν δεν υπάρχει
 * παράβαση headroom / η προβολή δεν πέφτει στην πλάκα. Ο ΑΚΡΙΒΗΣ pipeline:
 * headroom → margin expansion → union παραβατικών treads ∩ slab.
 */
function computeOpeningForPair(
  stair: StairwellPlanStair,
  overlap: StairSlabOverlap,
  marginTreads: number,
): StairwellDesiredOpening | null {
  const ev = evaluateStairHeadroom(stair.nosingsZmm, overlap.slab.undersideZmm, stair.minHeadroomMm);
  if (!ev.anyViolation) return null;

  const indices = expandViolatingRange(ev.violatingTreadIndices, marginTreads, stair.treads.length);
  const violatingTreads = indices
    .map((i) => stair.treads[i])
    .filter((t): t is Polygon3D => t !== undefined);
  if (violatingTreads.length === 0) return null;

  const res = computeStairwellOpeningOutline(violatingTreads, overlap.slab.outline, overlap.slab.topZmm);
  if (!res) return null;
  return {
    autoStairId: stair.stairId,
    slabId: overlap.slab.slabId,
    outline: res.outline,
    areaSceneUnits2: res.area,
  };
}

/** Χάρτης key→επιθυμητό opening για ΟΛΑ τα ζεύγη σκάλα↔πλάκα-από-πάνω. */
function computeDesiredOpenings(
  stairs: readonly StairwellPlanStair[],
  slabs: readonly StairwellSlabCandidate[],
  options: StairwellPlanOptions,
): Map<string, StairwellDesiredOpening> {
  const margin = options.marginTreads ?? STAIRWELL_OPENING_MARGIN_TREADS;
  const out = new Map<string, StairwellDesiredOpening>();
  for (const stair of stairs) {
    const footprint: StairFootprintInput = {
      stairId: stair.stairId,
      footprint: stair.footprint,
      baseZmm: stair.baseZmm,
      topZmm: stair.topZmm,
    };
    for (const overlap of findSlabsAboveStair(footprint, slabs, options)) {
      const desired = computeOpeningForPair(stair, overlap, margin);
      if (desired) out.set(stairwellOpeningPairKey(desired.autoStairId, desired.slabId), desired);
    }
  }
  return out;
}

// ─── Diff (desired vs existing managed) ──────────────────────────────────────

/** True αν δύο outlines ταυτίζονται (ίδιο πλήθος κορυφών + x/y εντός `eps`). */
function sameOutline(a: Polygon3D, b: Polygon3D, eps: number): boolean {
  const va = a.vertices;
  const vb = b.vertices;
  if (va.length !== vb.length) return false;
  for (let i = 0; i < va.length; i++) {
    if (Math.abs(va[i].x - vb[i].x) > eps || Math.abs(va[i].y - vb[i].y) > eps) return false;
  }
  return true;
}

/**
 * Διαφορά επιθυμητών vs υπαρχόντων managed openings → creates / updates / deletes.
 * Duplicate managed keys (θεωρητικά αδύνατο· belt-and-suspenders): κρατά το πρώτο,
 * τα υπόλοιπα → deletes. Idempotency: αμετάβλητο outline → ούτε update.
 */
function diffPlan(
  desired: ReadonlyMap<string, StairwellDesiredOpening>,
  existing: readonly StairwellManagedOpening[],
  eps: number,
): StairwellOpeningPlan {
  const existingByKey = new Map<string, StairwellManagedOpening>();
  const deletes: { openingId: string }[] = [];
  for (const managed of existing) {
    const key = stairwellOpeningPairKey(managed.autoStairId, managed.slabId);
    if (existingByKey.has(key)) deletes.push({ openingId: managed.openingId });
    else existingByKey.set(key, managed);
  }

  const creates: StairwellDesiredOpening[] = [];
  const updates: { openingId: string; outline: Polygon3D }[] = [];
  for (const [key, want] of desired) {
    const have = existingByKey.get(key);
    if (!have) creates.push(want);
    else if (!sameOutline(have.outline, want.outline, eps)) {
      updates.push({ openingId: have.openingId, outline: want.outline });
    }
  }
  for (const [key, managed] of existingByKey) {
    if (!desired.has(key)) deletes.push({ openingId: managed.openingId });
  }
  return { creates, updates, deletes };
}

// ─── Public entry ────────────────────────────────────────────────────────────

/**
 * Παράγει το diff plan των auto stairwell openings. Pure: δεν αγγίζει σκηνή —
 * ο coordinator εφαρμόζει το plan (add/update/remove + enterprise-id + persistence).
 *
 * @param stairs   resolved σκάλες (footprint + profile + treads + nosings σε mm).
 * @param slabs    υποψήφιες υπερκείμενες πλάκες (outline + top/underside σε mm).
 * @param existing τα ήδη-υπάρχοντα managed («autoStairId») openings της σκηνής.
 */
export function planStairwellOpenings(
  stairs: readonly StairwellPlanStair[],
  slabs: readonly StairwellSlabCandidate[],
  existing: readonly StairwellManagedOpening[],
  options: StairwellPlanOptions = {},
): StairwellOpeningPlan {
  const eps = options.outlineEps ?? DEFAULT_OUTLINE_EPS;
  const desired = computeDesiredOpenings(stairs, slabs, options);
  return diffPlan(desired, existing, eps);
}
