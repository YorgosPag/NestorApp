/**
 * ADR-632 CL-2 — Building-wide (cross-level) stairwell-opening planner (pure core).
 *
 * Ο single-level `cascadeStairwellOpenings` διαβάζει την σκηνή **ΕΝΟΣ** ορόφου
 * (`getEntities()`) → βλέπει μόνο ζεύγη σκάλα↔πλάκα στον **ίδιο** όροφο. Στο
 * πραγματικό Revit/ArchiCAD workflow η σκάλα ζει στον όροφο Ν και η πλάκα-οροφή που
 * την «καπακώνει» είναι το δάπεδο του ορόφου Ν+1 → **διαφορετικές σκηνές**. Αυτό το
 * module συνθέτει τις σκηνές όλων των ορόφων σε **κοινό απόλυτο datum** (κάθε πλευρά
 * ανεβαίνει κατά το FFL του ορόφου της — CL-1) και τρέχει τον **ίδιο** pure planner
 * (`planStairwellOpenings`) → μηδέν δεύτερος engine.
 *
 * **Cross-level ONLY (big-player, Revit/ArchiCAD: ένας owner ανά associative σχέση).**
 * Το ίδιο-όροφο ζεύγος το κατέχει ήδη ο command-time single-level cascade (undoable,
 * μέσα στο undo stack). Εδώ ζευγαρώνουμε ΜΟΝΟ σκάλες **άλλων** ορόφων με τις πλάκες
 * κάθε ορόφου-στόχου, και τα «υπάρχοντα» managed openings που κρίνονται είναι ΜΟΝΟ τα
 * cross-level (autoStairId που ΔΕΝ ανήκει σε σκάλα του ίδιου ορόφου) → κανένας
 * διπλός owner, μηδέν race με το command path (mirror foundation ADR-459: ο derived
 * writer αγγίζει μόνο τον cross-level όροφο, ποτέ τον ενεργό/command-owned).
 *
 * **Pure** — μηδέν scene mutation / React / IO / Firestore. Ο owner hook
 * (`useCrossLevelStairwellOpenings`) μαζεύει τα per-floor entities + το FFL καθενός
 * και εφαρμόζει το αποτέλεσμα μέσω του `stairwell-opening-cross-level-writer`.
 *
 * REUSE (SSoT, N.0.2 — μηδέν διπλή γεωμετρία/κατώφλι/id):
 *   · `buildStairwellPlanStairs` / `buildStairwellSlabCandidates` / `collectManagedStairwellOpenings`
 *     (CL-1 input builders, με το `floorElevationMm` offset ανά όροφο)
 *   · `planStairwellOpenings` (ο datum-agnostic pure planner)
 *   · `materializeStairwellAutoOpening` / `rebuildStairwellOpeningOutline` (shared apply SSoT)
 *
 * @see docs/centralized-systems/reference/adrs/ADR-632-stairwell-auto-opening-ssot.md §8b
 * @see bim/stairs/stairwell-opening-coordinator.ts — ο single-level coordinator (same-level owner)
 * @see bim/foundations/foundation-cross-level-writer.ts — το cross-level write pattern (ADR-459)
 */

import type { StairEntity } from '../types/stair-types';
import type { SlabEntity } from '../types/slab-types';
import type { SlabOpeningEntity } from '../types/slab-opening-types';
import {
  buildStairwellPlanStairs,
  buildStairwellSlabCandidates,
  collectManagedStairwellOpenings,
  type StairwellInputOptions,
} from './stairwell-opening-inputs';
import {
  planStairwellOpenings,
  type StairwellManagedOpening,
  type StairwellPlanOptions,
  type StairwellPlanStair,
} from '../geometry/stairs/stairwell-opening-plan';
import {
  materializeStairwellAutoOpening,
  rebuildStairwellOpeningOutline,
} from './stairwell-opening-coordinator';

// ─── Inputs ────────────────────────────────────────────────────────────────

/**
 * Ένας όροφος του ενεργού κτιρίου, resolved από τον owner hook: το DXF level id,
 * το durable persistence scope (`floorId`/`floorplanId`/`projectId`), το datum-
 * relative FFL (mm, `resolveFloorElevationMm`), και τα entities της σκηνής του
 * (live όταν ενεργός· `getLevelScene` snapshot όταν έχει επισκεφθεί· one-shot
 * `loadFileV2` αλλιώς). Τα `managedOpenings` = τα slab-opening entities της σκηνής.
 */
export interface CrossLevelFloorEntry {
  readonly levelId: string;
  readonly floorId: string | null;
  readonly floorplanId: string | null;
  readonly projectId: string | null;
  readonly floorElevationMm: number;
  readonly stairs: readonly StairEntity[];
  readonly slabs: readonly SlabEntity[];
  readonly managedOpenings: readonly SlabOpeningEntity[];
}

/** Μία υλοποιημένη ενέργεια writer ανά όροφο-στόχο (τον όροφο της πλάκας). */
export interface CrossLevelStairwellApply {
  /** Ο όροφος της πλάκας — εκεί ζει/γράφεται το «well» opening (scope + scene). */
  readonly levelId: string;
  readonly floorId: string | null;
  readonly floorplanId: string | null;
  readonly projectId: string | null;
  /** Νέα openings (materialized, deterministic id) προς εισαγωγή. */
  readonly creates: readonly SlabOpeningEntity[];
  /** Υπάρχοντα openings με ανανεωμένη γεωμετρία (host/σκάλα μετακινήθηκε). */
  readonly updates: readonly SlabOpeningEntity[];
  /** Ids openings προς διαγραφή (η σκάλα έφυγε / έπαψε η παράβαση). */
  readonly deletes: readonly string[];
}

export interface CrossLevelStairwellPlanOptions
  extends StairwellInputOptions,
    StairwellPlanOptions {}

// ─── Planner ─────────────────────────────────────────────────────────────────

/** Plan-stair tagged με τον όροφό της (για το cross-level pairing filter). */
interface TaggedPlanStair {
  readonly levelId: string;
  readonly stair: StairwellPlanStair;
}

/**
 * Building-wide cross-level plan. Για κάθε όροφο-στόχο (πλάκα) ζευγαρώνει τις πλάκες
 * του με τις σκάλες **ΟΛΩΝ ΤΩΝ ΑΛΛΩΝ** ορόφων (absolute Z) και επιστρέφει τις
 * writer-ενέργειες (creates/updates/deletes) — ΜΟΝΟ όταν υπάρχει πράγματι διαφορά
 * (idempotent: αμετάβλητη σκηνή → κενό αποτέλεσμα).
 *
 * @returns μία `CrossLevelStairwellApply` ανά όροφο με μη-κενό diff (οι υπόλοιποι
 *          παραλείπονται — μηδέν no-op write).
 */
export function planCrossLevelStairwellOpenings(
  entries: readonly CrossLevelFloorEntry[],
  options: CrossLevelStairwellPlanOptions = {},
): CrossLevelStairwellApply[] {
  // Plan-stairs κάθε ορόφου, lifted στο απόλυτο datum με το FFL του (CL-1), tagged
  // με το level ώστε ο στόχος να αποκλείει τις **δικές του** σκάλες (same-level =
  // command-owned).
  const allStairs: TaggedPlanStair[] = [];
  const stairIdsByLevel = new Map<string, Set<string>>();
  for (const entry of entries) {
    const ids = new Set<string>();
    for (const planStair of buildStairwellPlanStairs(entry.stairs, {
      ...options,
      floorElevationMm: entry.floorElevationMm,
    })) {
      allStairs.push({ levelId: entry.levelId, stair: planStair });
      ids.add(planStair.stairId);
    }
    stairIdsByLevel.set(entry.levelId, ids);
  }

  const out: CrossLevelStairwellApply[] = [];
  for (const target of entries) {
    // Σκάλες ΟΛΩΝ ΤΩΝ ΑΛΛΩΝ ορόφων (same-level ζεύγη τα κατέχει το command path).
    const crossStairs = allStairs
      .filter((s) => s.levelId !== target.levelId)
      .map((s) => s.stair);

    // «Υπάρχοντα» = ΜΟΝΟ τα cross-level managed openings αυτής της σκηνής: autoStairId
    // που ΔΕΝ ανήκει σε σκάλα του ίδιου ορόφου (same-level managed = command-owned,
    // δεν τα αγγίζουμε). Orphaned (autoStairId ανύπαρκτο πλέον) → μετρά cross → ο
    // planner το σβήνει (cleanup, ΑΚΟΜΗ κι όταν έφυγαν ΟΛΕΣ οι σκάλες).
    const ownStairIds = stairIdsByLevel.get(target.levelId) ?? new Set<string>();
    const existing: StairwellManagedOpening[] = collectManagedStairwellOpenings(
      target.managedOpenings,
    ).filter((m) => !ownStairIds.has(m.autoStairId));

    // Μηδέν cross-σκάλες ΚΑΙ μηδέν cross-managed → τίποτα να παραχθεί/καθαριστεί.
    if (crossStairs.length === 0 && existing.length === 0) continue;

    // Ο planner χειρίζεται μόνος του empty stairs/slabs (desired κενό → delete existing).
    const slabCandidates = buildStairwellSlabCandidates(target.slabs, target.floorElevationMm);
    const plan = planStairwellOpenings(crossStairs, slabCandidates, existing, options);
    if (plan.creates.length + plan.updates.length + plan.deletes.length === 0) continue;

    const slabById = new Map(target.slabs.map((s) => [s.id, s] as const));
    const openingById = new Map(target.managedOpenings.map((o) => [o.id, o] as const));

    const creates: SlabOpeningEntity[] = [];
    for (const desired of plan.creates) {
      const host = slabById.get(desired.slabId);
      if (!host) continue;
      const entity = materializeStairwellAutoOpening(desired, host, options.sceneUnits);
      if (entity) creates.push(entity);
    }

    const updates: SlabOpeningEntity[] = [];
    for (const { openingId, outline } of plan.updates) {
      const cur = openingById.get(openingId);
      if (!cur) continue;
      updates.push(rebuildStairwellOpeningOutline(cur, outline).entity);
    }

    const deletes = plan.deletes.map((d) => d.openingId);

    if (creates.length + updates.length + deletes.length === 0) continue;
    out.push({
      levelId: target.levelId,
      floorId: target.floorId,
      floorplanId: target.floorplanId,
      projectId: target.projectId,
      creates,
      updates,
      deletes,
    });
  }
  return out;
}
