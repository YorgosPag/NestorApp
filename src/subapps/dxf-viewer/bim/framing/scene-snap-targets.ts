/**
 * Scene snap-targets — ΕΝΑ κοινό SSoT για ΟΛΑ τα placement tools (ADR-398 §3.10 / ADR-508).
 *
 * **Γιατί υπάρχει (Giorgio SSoT audit, Revit-grade):** οι face-snap στόχοι (column footprints +
 * γραμμικά μέλη ως {axis,outline}) είναι ιδιότητα της **σκηνής**, ΟΧΙ του εργαλείου. Πριν, κάθε
 * placement tool (τοίχος/δοκάρι/κολώνα) κρατούσε τους **ίδιους** στόχους στο **δικό** του preview
 * store (3 παράλληλα αντίγραφα + 3 collectors) — anti-pattern. Εδώ ζουν **μία φορά**:
 *   · `collectSceneSnapTargets(entities)` — ο ΜΟΝΑΔΙΚΟΣ collector (reuse `collectMemberSnapTargets`).
 *   · `sceneSnapTargetsStore` — imperative zero-React store (mirror `ImmediateSnapStore`),
 *     γεμίζει ΜΙΑ φορά on activate / `drawing:entity-created` (μέσω `useSceneSnapTargetSync`),
 *     διαβάζεται imperatively από preview ghost + commit (draw-time, ΟΧΙ React-reactive).
 *   · `selectGhostMembers(targets, kinds)` — flat member list για όσους resolvers θέλουν
 *     συνδυασμένο `memberTargets` (τοίχος = wall+beam+slab, δοκάρι = beam+slab)· η κολώνα διαβάζει
 *     τα granular arrays απευθείας (bbox beam/wall vs axis-relative slab).
 *
 * Single-writer (το ενεργό tool μέσω `useSceneSnapTargetSync`), multi-reader (τα 3 preview paths
 * + commits). Pre-collected (ΟΧΙ per-frame) → ελαφρύ hover σε αδύναμο μηχάνημα. Zero React/DOM.
 *
 * @see ./member-snap-targets.ts — collectMemberSnapTargets (ο reused per-kind collector)
 * @see ../../hooks/drawing/use-scene-snap-target-sync.ts — ο populator (entity-created + rAF)
 * @see ./linear-member-face-snap.ts — LinearMemberSnapTarget (το στοιχείο)
 * @see docs/centralized-systems/reference/adrs/ADR-398-column-placement-snap.md §3.10
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import { collectMemberSnapTargets, type MemberSnapKind } from './member-snap-targets';
import type { LinearMemberSnapTarget } from './linear-member-face-snap';

/**
 * Pre-collected face-snap στόχοι της σκηνής, **διαχωρισμένοι ανά είδος** (granular superset). Η
 * κολώνα τους χειρίζεται διαφορετικά (κολόνες/δοκάρια/τοίχοι → bbox· πλάκες → axis-relative)·
 * τοίχος/δοκάρι παίρνουν flat συνδυασμό μέσω `selectGhostMembers`.
 */
export interface SceneSnapTargets {
  /** Column footprints (world-baked 2Δ πολύγωνα) — όλες οι 4 παρειές έγκυρες. */
  readonly footprints: readonly (readonly Point2D[])[];
  /** Υφιστάμενα δοκάρια ({axis, outline}). */
  readonly beamTargets: readonly LinearMemberSnapTarget[];
  /** Υφιστάμενοι τοίχοι ({axis, outline}). */
  readonly wallTargets: readonly LinearMemberSnapTarget[];
  /** Ακμές πλάκας ως {axis, outline}. */
  readonly slabTargets: readonly LinearMemberSnapTarget[];
  /** ADR-398 §3.11/§3.12 — σκέτες ΓΡΑΜΜΕΣ + ΠΟΛΥΓΡΑΜΜΕΣ + ΟΡΘΟΓΩΝΙΑ + ΚΥΚΛΟΙ + ΤΟΞΑ (`line`/`polyline`/
   *  `lwpolyline`/`rectangle`/`circle`/`arc`) ως zero-width {axis, outline} (ένα ανά τμήμα/πλευρά/χορδή).
   *  Κύκλος/τόξο φέρουν `arc` meta → arc-length listening dims. Μόνο η κολώνα τις καταναλώνει
   *  (ίδιο axis-relative path με ακμές πλάκας)· wall/beam T-framing ΟΧΙ. */
  readonly lineTargets: readonly LinearMemberSnapTarget[];
}

const EMPTY: SceneSnapTargets = Object.freeze({
  footprints: Object.freeze([]) as readonly (readonly Point2D[])[],
  beamTargets: Object.freeze([]) as readonly LinearMemberSnapTarget[],
  wallTargets: Object.freeze([]) as readonly LinearMemberSnapTarget[],
  slabTargets: Object.freeze([]) as readonly LinearMemberSnapTarget[],
  lineTargets: Object.freeze([]) as readonly LinearMemberSnapTarget[],
});

/**
 * Ο ΜΟΝΑΔΙΚΟΣ collector face-snap στόχων (reuse `collectMemberSnapTargets`· οι κολόνες μαζεύονται
 * πάντα μαζί με τα δοκάρια). Pure. Καταναλώνεται από το store (`refresh`) + το `resolveColumnFaceSnap`
 * wrapper (preview ≡ commit ≡ ίδιοι στόχοι).
 */
export function collectSceneSnapTargets(entities: readonly Entity[]): SceneSnapTargets {
  const beamPass = collectMemberSnapTargets(entities, { memberKinds: ['beam'] });
  return {
    footprints: beamPass.footprints,
    beamTargets: beamPass.memberTargets,
    wallTargets: collectMemberSnapTargets(entities, { memberKinds: ['wall'] }).memberTargets,
    slabTargets: collectMemberSnapTargets(entities, { memberKinds: ['slab'] }).memberTargets,
    lineTargets: collectMemberSnapTargets(entities, { memberKinds: ['line'] }).memberTargets,
  };
}

/**
 * Flat λίστα γραμμικών μελών για resolvers που θέλουν συνδυασμένο `memberTargets`
 * (τοίχος → `['wall','beam','slab']`, δοκάρι → `['beam','slab']`). Pure. Η κολώνα ΔΕΝ το χρειάζεται
 * (διαβάζει τα granular arrays). Σταθερή σειρά (wall→beam→slab) για ντετερμινισμό.
 */
export function selectGhostMembers(
  t: Readonly<SceneSnapTargets>,
  kinds: readonly MemberSnapKind[],
): LinearMemberSnapTarget[] {
  const out: LinearMemberSnapTarget[] = [];
  if (kinds.includes('wall')) out.push(...t.wallTargets);
  if (kinds.includes('beam')) out.push(...t.beamTargets);
  if (kinds.includes('slab')) out.push(...t.slabTargets);
  return out;
}

let current: SceneSnapTargets = EMPTY;

export const sceneSnapTargetsStore = {
  /** Low-level writer — set pre-collected στόχους απευθείας (escape hatch + tests). */
  set(targets: SceneSnapTargets): void {
    current = targets;
  },
  /** Writer — collect από `entities` + set (από `useSceneSnapTargetSync` on activate / entity-created). */
  refresh(entities: readonly Entity[]): void {
    current = collectSceneSnapTargets(entities);
  },
  /** Reset back to empty (placement tool deactivated). */
  reset(): void {
    current = EMPTY;
  },
  /** Reader (non-React) — escape hatch για preview ghost + commit + tests. */
  get(): SceneSnapTargets {
    return current;
  },
};
