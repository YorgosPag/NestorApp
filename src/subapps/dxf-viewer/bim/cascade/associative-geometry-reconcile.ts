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
 *     - **ετικέτα εμβαδού → πηγή** (`cascadeAreaLabels`, ADR-649 §associative): το εμβαδόν
 *       ξαναμετριέται, δεν «ακολουθεί» delta — γι' αυτό ανήκει εδώ και όχι στους followers.
 *       Καλύπτει γραμμοσκίαση ΚΑΙ τοπογραφική επιφάνεια με ΕΝΑΝ μηχανισμό.
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
import { cascadeStairRailings } from '../stairs/stair-railing-coordinator';
import { cascadeAreaLabels } from '../../systems/measure/area-label-cascade';
import { cascadeTopoSourceGeometry } from '../../systems/topography/topo-source-cascade';
import { EventBus } from '../../systems/events/EventBus';

/**
 * Minimal scene-manager surface (union των reused cascades). `addEntity`/
 * `removeEntity` για το stairwell lifecycle cascade (ADR-632 Φ4 — create/delete
 * auto openings)· τα υπάρχοντα callers (`ISceneManager`) τα έχουν ήδη όλα.
 */
type CascadeSceneManager = Pick<
  ISceneManager,
  'getEntity' | 'updateEntities' | 'addEntity' | 'removeEntity' | 'updateEntity'
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

  // (1c) σκάλα → auto hosted railing (ADR-407 Φ7): lifecycle (create/update/delete) auto κάγκελο
  //      (κουπαστή + ορθοστάτες + κάθετα) ανά ενεργή πλευρά handrail. Idempotent + changedIds gate
  //      (skip αν το command δεν άγγιξε σκάλα)· εκπέμπει μόνο του τα `drawing:entity-created`
  //      (tool `'railing'`) / `bim:railing-delete-requested` → persist+BOQ μέσω useRailingPersistence.
  cascadeStairRailings(sceneManager, { changedIds });

  // (2) beams → column faces: τα `startPoint/endPoint` (persisted params) αλλάζουν → πρέπει να
  //     ταξιδέψουν σε `bim:entities-moved` (per-entity Firestore persist + organism re-derive).
  const reframed = cascadeBeamReframe(changedIds, sceneManager);

  // (2b) ζωντανή ετικέτα εμβαδού → πηγή (ADR-649 §associative): το εμβαδόν ΞΑΝΑΜΕΤΡΙΕΤΑΙ από
  //      την τρέχουσα σκηνή (scene-derived, χωρίς delta) και το κείμενο της ετικέτας
  //      ενημερώνεται. Καλύπτει με ΕΝΑΝ μηχανισμό και τη γραμμοσκίαση (grip/μετασχηματισμός
  //      μέσω των δύο υπαρχόντων call sites) και την τοπογραφική επιφάνεια. Ιδεμποτεντικό:
  //      αμετάβλητο κείμενο → κανένα patch, άρα κανένα emit (ADR-492 §4 zero-loop).
  const relabelled = cascadeAreaLabels(changedIds, sceneManager);

  // (2c) τοπογραφικοί ορισμοί → γραμμή του σχεδίου (ADR-718 Μ3): το όριο οικοπέδου και οι
  //      ασυνέχειες κρατούσαν snapshot κορυφών με ένα `sourceEntityId` που **κανείς δεν
  //      παρακολουθούσε** — σύρσιμο λαβής της πολυγραμμής άφηνε την κοπή στο παλιό σχήμα
  //      (ακριβώς η «λαβή που δεν κάνει τίποτα» του ADR-654). Scene-derived και ιδεμποτεντικό
  //      σαν τους υπόλοιπους. Γράφει σε **store** (TopoPointStore), όχι σε entities, άρα δεν
  //      συμμετέχει στο ενιαίο emit παρακάτω· τα παράγωγα της κάτοψης τα αναλαμβάνει ο
  //      υπάρχων crop reconciler του `useTopoPersistence` (ταυτότητα `getActiveCropRing()`).
  cascadeTopoSourceGeometry(changedIds, sceneManager);

  // (3) ΕΝΑ emit: announceEntities (transform hosts + followers) + reframed δοκάρια, dedup ανά id
  //     (το reframed νικά — όταν το ίδιο το δοκάρι μετασχηματίστηκε ΚΑΙ ξανα-κόπηκε, στέλνεται μία
  //     φορά με την τελική framed γεωμετρία).
  const byId = new Map<string, SceneEntity>();
  for (const e of options.announceEntities ?? []) byId.set(e.id, e);
  for (const b of reframed) byId.set(b.id, b as unknown as SceneEntity);
  for (const l of relabelled) byId.set(l.id, l);
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
 * Καλείται από το create SSoT `CreateBimEntityCommand` (execute/redo/undo) — το ΕΝΑ
 * undoable create path για ΟΛΑ τα BIM entities (slab/beam/…) **και τη σκάλα** (ADR-632
 * Φ5: το `addStairToScene` δεν καλεί πλέον απευθείας τον reconcile — περνά μέσω
 * `appendEntityToScene` → `CreateBimEntityCommand`, οπότε ο cascade έρχεται από
 * execute/redo/undo σαν κάθε άλλο create· κανένα χειροκίνητο/διπλό call site).
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
 * @see core/commands/entity-commands/CreateBimEntityCommand.ts — undoable create call site (slab/beam/stair/…)
 * @see bim/stairs/add-stair-to-scene.ts — stair wrapper → appendEntityToScene → command (ADR-632 Φ5)
 * @see bim/stairs/stairwell-opening-coordinator.ts — `cascadeStairwellOpenings` (reused)
 */
export function reconcileAssociativeGeometryOnCreate(
  createdEntity: Entity,
  sceneManager: CascadeSceneManager,
): void {
  if (!isStairEntity(createdEntity) && !isSlabEntity(createdEntity)) return;
  cascadeStairwellOpenings(sceneManager);
  // ADR-407 Φ7 — μια νέα σκάλα γεννά αυτόματα το/τα hosted κάγκελό της on-creation (Revit parity:
  // το Railing δημιουργείται μαζί με τη σκάλα, όχι μόνο on host-change). Type-gated στη σκάλα.
  if (isStairEntity(createdEntity)) cascadeStairRailings(sceneManager);
}

/**
 * ADR-649 §associative — **DELETE-time** associative trigger (SSoT).
 *
 * Το {@link reconcileAssociativeGeometry} τρέχει σε **αλλαγή** host, το
 * {@link reconcileAssociativeGeometryOnCreate} σε **δημιουργία** — η **διαγραφή** ήταν το
 * τρίτο, ακάλυπτο σκέλος του κύκλου ζωής. Χωρίς αυτό, σβήνοντας μια γραμμοσκίαση η ετικέτα
 * της έμενε να δείχνει έναν αριθμό που **δεν αντιστοιχούσε πια σε τίποτα**, χωρίς καμία
 * ένδειξη — ακριβώς το ψέμα που το associative υποτίθεται ότι εξαλείφει.
 *
 * ⚠️ **Τρέχει ΜΟΝΟ τους δύο link-based reconcilers (ετικέτα εμβαδού + τοπογραφικοί ορισμοί),
 * ΟΧΙ ολόκληρο τον geometry cascade** — και αυτό είναι σκόπιμο, με το ίδιο σκεπτικό που το
 * create path τρέχει υποσύνολο: οι geometry
 * cascades (ανοίγματα/δοκάρια/κλιμακοστάσιο/κάγκελα) έχουν τη δική τους διαδρομή διαγραφής
 * και το να τους καλέσουμε εδώ θα άλλαζε σιωπηλά συμπεριφορά τοίχων/σκαλών που καμία ανάγκη
 * δεν το ζήτησε. Ένα lifecycle hook αγγίζει ό,τι ξέρει ότι σπάει, όχι ό,τι μπορεί.
 *
 * **Συμμετρικό στο undo:** ο ίδιος reconciler καλείται και όταν η οντότητα **επιστρέφει** —
 * διαβάζει την τρέχουσα σκηνή, βρίσκει την πηγή ζωντανή και ξανα-γράφει τον πραγματικό
 * αριθμό. Καμία ξεχωριστή διαδρομή «un-orphan», καμία κατάσταση να ξεσυγχρονιστεί.
 *
 * @see core/commands/entity-commands/DeleteEntityCommand.ts — execute / undo / redo call site
 * @see systems/measure/area-label-cascade.ts — `cascadeAreaLabels` (ο ίδιος, reused)
 * @see systems/topography/topo-source-cascade.ts — `cascadeTopoSourceGeometry` (ο ίδιος, reused)
 */
export function reconcileAssociativeGeometryOnDelete(
  affectedIds: readonly string[],
  sceneManager: CascadeSceneManager,
): void {
  // ADR-718 Μ3 — η διαγραφή της πολυγραμμής-ορίου (ή μιας γραμμής-ασυνέχειας) είναι ο ΤΡΙΤΟΣ
  // τρόπος να σπάσει ο δεσμός, δίπλα στο σύρσιμο λαβής και στο άνοιγμα του περιγράμματος. Ο
  // ΙΔΙΟΣ reconciler τη διαβάζει: κρατά το τελευταίο έγκυρο σχήμα (η κοπή ΔΕΝ εξαφανίζεται
  // σιωπηλά — θα άλλαζαν οι όγκοι εκσκαφής) και σημειώνει τον δεσμό ως `missing`, ώστε το
  // ribbon να το πει. Στο **undo** το ίδιο πέρασμα βρίσκει την οντότητα ζωντανή και ο δεσμός
  // επανέρχεται μόνος του — καμία ξεχωριστή διαδρομή «re-link» να ξεσυγχρονιστεί.
  cascadeTopoSourceGeometry(affectedIds, sceneManager);

  const relabelled = cascadeAreaLabels(affectedIds, sceneManager);
  if (relabelled.length === 0) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  EventBus.emit('bim:entities-moved', { movedEntities: relabelled as any });
}
