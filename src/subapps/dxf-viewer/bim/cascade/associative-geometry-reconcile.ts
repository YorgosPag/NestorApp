/**
 * UNIVERSAL ASSOCIATIVE GEOMETRY RECONCILE — ADR-540 (SSoT).
 *
 * ΕΝΑ κεντρικό σημείο που, μετά από **ΚΑΘΕ** geometry-mutating command, ξανα-derive-άρει
 * όλα τα **scene-derived** εξαρτημένα μέλη, ώστε οι λαβές τους (που διαβάζουν τα params) να
 * είναι **ΠΑΝΤΑ** στη σωστή θέση — ποτέ ξανά stale. Revit / Cinema 4D-grade.
 *
 * **Η ρίζα των stale λαβών (audit ADR-540):** το πρόβλημα ΔΕΝ είναι UI — οι λαβές
 * υπολογίζονται σωστά από τα params (`computeDxfEntityGrips`). Το πρόβλημα είναι ότι τα
 * params των εξαρτημένων μελών δεν re-derive-άρονταν όταν ο host άλλαζε μέσω
 * `Update*ParamsCommand` (column/beam/foundation/wall), που — σε αντίθεση με τα transform
 * commands — δεν έτρεχαν κανένα cascade. Π.χ. η προαγωγή κολόνας σε Γ (= `UpdateColumnParams`)
 * μεγάλωνε το footprint αλλά δεν ξανα-έκοβε το δοκάρι → stale beam endpoint.
 *
 * **Δύο κατηγορίες associative re-derivation — μόνο η μία ζει εδώ:**
 *  1. **Scene-derived reconcilers** (idempotent, διαβάζουν την ΤΡΕΧΟΥΣΑ σκηνή, ΧΩΡΙΣ delta):
 *     - openings → wall  (`cascadeHostedOpeningsForWalls`)
 *     - beams → column faces (`cascadeBeamReframe`)
 *     Αυτά ανήκουν εδώ: τρέχουν μετά από **οποιαδήποτε** αλλαγή host (transform Ή params).
 *  2. **Delta-followers** (χρειάζονται το transform delta dx,dy): connected pipes + slab-openings.
 *     ΔΕΝ ζουν εδώ — ένα params-edit δεν παράγει delta γι' αυτά· μένουν transform-only μέσα
 *     στο `SnapshotTransformCommand.runForwardFollowerCascades` (ADR-408 Φ-C / ADR-507 §8).
 *
 * **Γιατί command-time, ΟΧΙ reactive effect (ADR-492 §4):** ένας reactive effect που άκουγε
 * `bim:entities-moved`/`bim:*-params-updated` και ξανα-εξέπεμπε geometry event → βρόχος με τον
 * proactive analysis cycle → storm/freeze στο «Ανάλυση». Εδώ τρέχει **σύγχρονα μέσα στην
 * εντολή**, με **ΕΝΑ** `bim:entities-moved` και **idempotency** (αμετάβλητο → κανένα emit) →
 * ο κύκλος συγκλίνει, μηδέν reactive re-trigger.
 *
 * **Grip refresh (auto, μηδέν νέος κώδικας):** το `bim:entities-moved` ενημερώνει τον entities
 * store → 2D λαβές (`grip-registry` useMemo) + 3D λαβές (`use-bim3d-edit-interaction`
 * subscribe → `refreshReshapeGrips`) ξανα-κάθονται αυτόματα στη νέα γεωμετρία.
 *
 * @see bim/walls/wall-opening-coordinator.ts — `cascadeHostedOpeningsForWalls` (reused)
 * @see bim/beams/beam-column-reframe-cascade.ts — `cascadeBeamReframe` (reused)
 * @see core/commands/entity-commands/MergeableUpdateCommand.ts — params-family call site
 * @see core/commands/entity-commands/SnapshotTransformCommand.ts — transform-family call site
 * @see docs/centralized-systems/reference/adrs/ADR-540-universal-associative-geometry-reconcile.md
 */

import type { ISceneManager, SceneEntity } from '../../core/commands/interfaces';
import { isSlabEntity, isStairEntity, type Entity } from '../../types/entities';
import { cascadeHostedOpeningsForWalls } from '../walls/wall-opening-coordinator';
import { cascadeBeamReframe } from '../beams/beam-column-reframe-cascade';
import { cascadeStairwellOpenings } from '../stairs/stairwell-opening-coordinator';
import { EventBus } from '../../systems/events/EventBus';

/**
 * Minimal scene-manager surface (union των reused cascades). `addEntity`/
 * `removeEntity` για το stairwell lifecycle cascade (ADR-632 Φ4 — create/delete
 * auto openings)· τα υπάρχοντα callers (`ISceneManager`) τα έχουν ήδη όλα.
 */
type CascadeSceneManager = Pick<
  ISceneManager,
  'getEntity' | 'updateEntities' | 'addEntity' | 'removeEntity'
> & {
  getEntities?(): readonly SceneEntity[];
};

export interface ReconcileAssociativeGeometryOptions {
  /**
   * Entities που πρέπει να συμπεριληφθούν στο `bim:entities-moved` ΜΑΖΙ με τα re-derived
   * (reframed) μέλη. Τα transform commands περνούν εδώ τους μετασχηματισμένους hosts + τους
   * delta-followers τους ώστε όλα να ταξιδέψουν σε ΕΝΑ event (όπως πριν το παλιό
   * `reframeBeamsAndEmit`). Τα params commands το αφήνουν κενό — ο host τους εκπέμπεται
   * ξεχωριστά από τον dispatcher (`bim:*-params-updated`) — οπότε εδώ εκπέμπονται **μόνο** τα
   * re-derived εξαρτημένα (mirror του παλιού `reframeBeamsAndEmitAfterRestore`).
   */
  readonly announceEntities?: readonly SceneEntity[];
}

/**
 * Τρέχει ΟΛΟΥΣ τους scene-derived reconcilers σε dependency order και εκπέμπει **ΕΝΑ**
 * `bim:entities-moved` για τα μέλη που άλλαξαν persisted params. Καλείται **αφού** η αλλαγή
 * του host έχει «κάτσει» στη σκηνή (οι cascades διαβάζουν την τρέχουσα γεωμετρία).
 *
 * Idempotent: αν κανένα εξαρτημένο μέλος δεν χρειάστηκε re-derive και δεν δόθηκαν
 * `announceEntities` → **κανένα emit** (μηδέν persist churn, αποφυγή freeze ADR-492 §4).
 */
export function reconcileAssociativeGeometry(
  changedIds: readonly string[],
  sceneManager: CascadeSceneManager,
  options: ReconcileAssociativeGeometryOptions = {},
): void {
  // (1) openings → wall: μόνο derived geometry (offsetFromStart αμετάβλητο) → χωρίς persist/emit.
  cascadeHostedOpeningsForWalls(changedIds, sceneManager);

  // (1b) stairwell openings → σκάλα/πλάκα (ADR-632 Φ4): lifecycle (create/update/delete)
  //      auto «well» openings όταν μια πλάκα καπακώνει σκάλα κάτω από το ελεύθερο ύψος.
  //      Idempotent + changedIds gate (skip αν το command δεν άγγιξε σκάλα/πλάκα)· εκπέμπει
  //      μόνο του τα `drawing:entity-created`/`bim:slab-opening-delete-requested` (persist+BOQ).
  cascadeStairwellOpenings(sceneManager, { changedIds });

  // (2) beams → column faces: τα `startPoint/endPoint` (persisted params) αλλάζουν → πρέπει να
  //     ταξιδέψουν σε `bim:entities-moved` (per-entity Firestore persist + organism re-derive).
  const reframed = cascadeBeamReframe(changedIds, sceneManager);

  // (3) ΕΝΑ emit: announceEntities (transform hosts + followers) + reframed δοκάρια, dedup ανά id
  //     (το reframed νικά — όταν το ίδιο το δοκάρι μετασχηματίστηκε ΚΑΙ ξανα-κόπηκε, στέλνεται μία
  //     φορά με την τελική framed γεωμετρία).
  const byId = new Map<string, SceneEntity>();
  for (const e of options.announceEntities ?? []) byId.set(e.id, e);
  for (const b of reframed) byId.set(b.id, b as unknown as SceneEntity);
  if (byId.size === 0) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  EventBus.emit('bim:entities-moved', { movedEntities: [...byId.values()] as any });
}

/**
 * ADR-632 Φ4.1 — CREATE-time associative trigger (SSoT).
 *
 * Το {@link reconcileAssociativeGeometry} τρέχει μόνο σε **αλλαγή** host (params-edit /
 * transform command bases) — ΟΧΙ σε **δημιουργία** entity. Έτσι το πρωτεύον σενάριο
 * «σχεδιάζω πλάκα οροφής πάνω από **υπάρχουσα** σκάλα → η τρύπα κλιμακοστασίου εμφανίζεται
 * ΑΜΕΣΩΣ» (και το συμμετρικό «σκάλα κάτω από υπάρχουσα πλάκα») δεν πυροδοτούνταν: η τρύπα
 * φαινόταν μόνο αφού μετακινηθεί/επεξεργαστεί η πλάκα. Οι μεγάλοι (Revit/ArchiCAD)
 * regenerate τα associative floor/stair openings **και on creation**, όχι μόνο on
 * host-change — αυτό εδώ κλείνει το κενό, industry-correct.
 *
 * Καλείται από τα **δύο** creation SSoTs (mirror των δύο edit/transform command bases):
 *  · `CreateBimEntityCommand` (execute/redo/undo) — undoable slab/beam/… create path
 *  · `addStairToScene` — ιστορικό raw-`setLevelScene` stair create path (μη-undoable)
 *
 * **Type-gated:** μόνο **σκάλα ή πλάκα** ξεκινούν τον stairwell cascade — κάθε άλλο create
 * (κολόνα / δοκάρι / έπιπλο / διάσταση …) κάνει no-op στην πρώτη γραμμή (μηδέν κόστος).
 *
 * **Full recompute (χωρίς `changedIds` gate):** ο gate εδώ έγινε ήδη με τον τύπο του
 * δημιουργημένου entity (πάντα διαθέσιμος, ανεξάρτητα scene membership), οπότε ο cascade
 * τρέχει idempotent σε ΟΛΗ τη σκηνή — ώστε να συγκλίνει ΚΑΙ στο **undo**, όπου το νέο
 * entity μόλις αφαιρέθηκε από τη σκηνή (planner → σβήνει το orphan «well» opening).
 *
 * **Zero-loop (ADR-492 §4):** ο cascade προσθέτει το opening με raw `addEntity` (ΟΧΙ νέα
 * command) και τα lifecycle emits του είναι deferred (`queueMicrotask`) → κανένα
 * re-entrant create/geometry-moved event· ο planner επιστρέφει άδειο diff στο 2ο run.
 *
 * @see core/commands/entity-commands/CreateBimEntityCommand.ts — undoable create call site
 * @see bim/stairs/add-stair-to-scene.ts — raw stair create call site
 * @see bim/stairs/stairwell-opening-coordinator.ts — `cascadeStairwellOpenings` (reused)
 */
export function reconcileAssociativeGeometryOnCreate(
  createdEntity: Entity,
  sceneManager: CascadeSceneManager,
): void {
  if (!isStairEntity(createdEntity) && !isSlabEntity(createdEntity)) return;
  cascadeStairwellOpenings(sceneManager);
}
