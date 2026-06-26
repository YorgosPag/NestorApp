/**
 * Beam↔Column re-frame cascade — ADR-492 (mirror του `wall-opening-coordinator`).
 *
 * Το δοκάρι είναι associatively attached στις κολώνες που πλαισιώνει. Όταν αλλάζει η
 * σχετική τους γεωμετρία —είτε **μετακινείται μια κολώνα** (ADR-492 Φ1), είτε
 * **μετασχηματίζεται το ΙΔΙΟ το δοκάρι** (rotate/move/scale/mirror — ADR-492 Φ2)— τα
 * άκρα του πρέπει να ξανα-κοπούν στην κοντινή παρειά κάθε στηρίζουσας κολώνας (αλλιώς
 * αφήνουν κενό ή περνούν μέσα της & προεξέχουν stub). Αυτό το module είναι το **ΕΝΑ
 * σημείο** που το κάνει, καλούμενο **μέσα** από τα transform commands **αφού** ο
 * μετασχηματισμός έχει «κάτσει» στη σκηνή — ΑΚΡΙΒΩΣ όπως το `cascadeHostedOpeningsForWalls`
 * τρέχει για τα ανοίγματα.
 *
 * **Γιατί cascade-στην-εντολή, ΟΧΙ reactive effect:** ένας reactive effect που άκουγε
 * `bim:entities-moved`/`bim:column-params-updated` και **ξανα-εξέπεμπε** `bim:entities-moved`
 * έμπαινε σε βρόχο με τον engaged proactive στατικό κύκλο (organism→reinforce/FEM→params-
 * updated→effect→emit→…) → storm/freeze στο «Ανάλυση». Εδώ τρέχει **συγχρονισμένα μέσα στον
 * μετασχηματισμό**: τα reframed δοκάρια ταξιδεύουν στο **ΙΔΙΟ** `bim:entities-moved` της
 * εντολής (μηδέν δεύτερο event, μηδέν reactive re-trigger). Ο οργανισμός βλέπει τη σωστή
 * γεωμετρία με ΕΝΑ pass.
 *
 * Undo/redo: ο επανα-υπολογισμός γίνεται από τη ΘΕΣΗ της κολώνας + τον (επαναφερμένο) άξονα
 * του δοκαριού (idempotent) → όπως τα ανοίγματα, δεν χρειάζεται snapshot· re-run μετά την
 * επαναφορά ανακτά την προηγούμενη framed γεωμετρία.
 *
 * @see bim/walls/wall-opening-coordinator.ts — ο δίδυμος (ανοίγματα ↔ τοίχος)
 * @see bim/beams/beam-column-reframe.ts — `reframeBeamEndpointsToColumns` (pure SSoT)
 * @see docs/centralized-systems/reference/adrs/ADR-492-associative-beam-reframe-on-column-move.md
 */

import type { ISceneManager, SceneEntity } from '../../core/commands/interfaces';
import type { Entity } from '../../types/entities';
import { isBeamEntity, isColumnEntity } from '../../types/entities';
import type { BeamEntity } from '../types/beam-types';
import { computeBeamGeometry } from '../geometry/beam-geometry';
import { reframeBeamEndpointsToColumns } from './beam-column-reframe';
import { EventBus } from '../../systems/events/EventBus';

/** Minimal scene-manager surface (ίδιο με τον wall-opening cascade). */
type CascadeSceneManager = Pick<ISceneManager, 'updateEntities'> & {
  getEntities?(): readonly SceneEntity[];
};

/**
 * Re-frame όλων των straight δοκαριών στις παρειές των κολωνών τους, **όταν** η αλλαγή
 * αφορούσε ≥1 κολώνα **ή** ≥1 δοκάρι (transform του ίδιου του δοκαριού — ADR-492 Φ2).
 * Εφαρμόζει τα patches (params + geometry) σε ΕΝΑ batch `updateEntities` και επιστρέφει τα
 * reframed δοκάρια ώστε ο caller να τα συμπεριλάβει στο `bim:entities-moved` (persist +
 * organism). No-op (κενό array) όταν: κανένα αλλαγμένο id δεν είναι κολώνα ή δοκάρι, ο
 * sceneManager δεν εκθέτει `getEntities`, ή καμία αλλαγή (reframe idempotent → null).
 *
 * Reframe ΟΛΩΝ των δοκαριών (όχι μόνο των άμεσα εμπλεκόμενων): είναι idempotent (αμετάβλητα
 * δοκάρια → null) → μόνο τα πραγματικά επηρεασμένα αλλάζουν, χωρίς να χρειάζεται ανά-id
 * ευρετήριο. Self-healing (πιάνει και προϋπάρχοντα stub). Η συσχέτιση ανά άκρο χρησιμοποιεί
 * τον **τρέχοντα** (post-transform) άξονα του δοκαριού, οπότε μετά από rotate βρίσκει τις
 * κολώνες που έγιναν συγγραμμικές με τη ΝΕΑ διεύθυνση.
 */
export function cascadeBeamReframe(
  movedEntityIds: readonly string[],
  sceneManager: CascadeSceneManager,
): BeamEntity[] {
  const all = sceneManager.getEntities?.();
  if (!all) return [];
  const entities = all as unknown as readonly Entity[];
  const movedSet = new Set(movedEntityIds);

  const columns = entities.filter(isColumnEntity);
  if (columns.length === 0) return [];
  // ADR-492 Φ2 — proceed όταν το αλλαγμένο σύνολο περιέχει κολώνα Ή δοκάρι. (Φ1 ήταν
  // μόνο κολώνα· το beam-transform έπεφτε σιωπηλά σε no-op εδώ.)
  const movedHasColumn = columns.some((c) => movedSet.has(c.id));
  const movedHasBeam = entities.some((e) => isBeamEntity(e) && movedSet.has(e.id));
  if (!movedHasColumn && !movedHasBeam) return [];

  const patches = new Map<string, Partial<SceneEntity>>();
  const reframed: BeamEntity[] = [];
  for (const e of entities) {
    if (!isBeamEntity(e)) continue;
    const next = reframeBeamEndpointsToColumns(e, columns);
    if (!next) continue;
    const params = { ...e.params, startPoint: next.startPoint, endPoint: next.endPoint };
    const geometry = computeBeamGeometry(params);
    patches.set(e.id, { params, geometry } as unknown as Partial<SceneEntity>);
    reframed.push({ ...e, params, geometry });
  }

  if (patches.size > 0) sceneManager.updateEntities(patches);
  return reframed;
}

/**
 * ADR-492 Φ2 / ADR-540 — undo-side race-guard: εκπέμπει τα restored (snapshot) entities **ΠΡΙΝ**
 * ο caller αγγίξει τη σκηνή, ώστε τα persistence hooks να τα μαρκάρουν dirty πριν φτάσει τυχόν
 * ca9-reset Firestore snapshot (που ακόμη κρατά την transformed γεωμετρία και θα την ξανα-εφάρμοζε).
 * No-op σε άδειο σύνολο.
 *
 * Μένει εδώ (ΟΧΙ μέσα στο `reconcileAssociativeGeometry`) γιατί πρέπει να τρέξει ΠΡΙΝ το
 * scene-restore: ο caller κάνει restore + reconcile **μετά**. Έτσι το restore emit μένει ΠΑΝΤΑ
 * πρώτο και το reframed emit (από το reconcile) ξεχωριστό — μηδέν reactive loop (μάθημα ADR-492 §4).
 *
 * @see bim/cascade/associative-geometry-reconcile.ts — `reconcileAssociativeGeometry` (το «μετά»)
 */
export function emitRestoredEntities(restored: readonly SceneEntity[]): void {
  if (restored.length === 0) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  EventBus.emit('bim:entities-moved', { movedEntities: [...restored] as any });
}
