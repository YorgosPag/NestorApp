/**
 * Beam→Column re-frame cascade — ADR-492 (mirror του `wall-opening-coordinator`).
 *
 * Όταν μετακινείται μια κολώνα, τα δοκάρια που την πλαισιώνουν (frame-into) πρέπει να
 * ξανα-κοπούν στην κοντινή παρειά της (αλλιώς περνούν μέσα της & προεξέχουν stub). Αυτό
 * το module είναι το **ΕΝΑ σημείο** που το κάνει, καλούμενο **μέσα** από τα move commands
 * **αφού** η μετακίνηση έχει «κάτσει» στη σκηνή — ΑΚΡΙΒΩΣ όπως το
 * `cascadeHostedOpeningsForWalls` τρέχει για τα ανοίγματα.
 *
 * **Γιατί cascade-στην-εντολή, ΟΧΙ reactive effect:** ένας reactive effect που άκουγε
 * `bim:entities-moved`/`bim:column-params-updated` και **ξανα-εξέπεμπε** `bim:entities-moved`
 * έμπαινε σε βρόχο με τον engaged proactive στατικό κύκλο (organism→reinforce/FEM→params-
 * updated→effect→emit→…) → storm/freeze στο «Ανάλυση». Εδώ τρέχει **συγχρονισμένα μέσα στη
 * μετακίνηση**: τα reframed δοκάρια ταξιδεύουν στο **ΙΔΙΟ** `bim:entities-moved` της εντολής
 * (μηδέν δεύτερο event, μηδέν reactive re-trigger). Ο οργανισμός βλέπει τη σωστή γεωμετρία
 * με ΕΝΑ pass.
 *
 * Undo/redo: ο επανα-υπολογισμός γίνεται από τη ΘΕΣΗ της κολώνας (idempotent) → όπως τα
 * ανοίγματα, δεν χρειάζεται snapshot του δοκαριού· re-run μετά την επαναφορά της κολώνας
 * ανακτά την προηγούμενη γεωμετρία.
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

/** Minimal scene-manager surface (ίδιο με τον wall-opening cascade). */
type CascadeSceneManager = Pick<ISceneManager, 'updateEntities'> & {
  getEntities?(): readonly SceneEntity[];
};

/**
 * Re-frame όλων των straight δοκαριών στις παρειές των κολωνών τους, **όταν** η κίνηση
 * αφορούσε ≥1 κολώνα. Εφαρμόζει τα patches (params + geometry) σε ΕΝΑ batch `updateEntities`
 * και επιστρέφει τα reframed δοκάρια ώστε ο caller να τα συμπεριλάβει στο `bim:entities-moved`
 * (persist + organism). No-op (κενό array) όταν: κανένα κινούμενο id δεν είναι κολώνα, ο
 * sceneManager δεν εκθέτει `getEntities`, ή καμία αλλαγή (reframe idempotent → null).
 *
 * Reframe ΟΛΩΝ των δοκαριών (όχι μόνο όσων πλαισιώνουν τις moved κολώνες): είναι idempotent
 * (αμετάβλητα δοκάρια → null) → μόνο τα πραγματικά επηρεασμένα αλλάζουν, χωρίς να χρειάζεται
 * ανά-κολώνα ευρετήριο. Self-healing (πιάνει και προϋπάρχοντα stub).
 */
export function cascadeBeamReframeForColumns(
  movedEntityIds: readonly string[],
  sceneManager: CascadeSceneManager,
): BeamEntity[] {
  const all = sceneManager.getEntities?.();
  if (!all) return [];
  const entities = all as unknown as readonly Entity[];
  const movedSet = new Set(movedEntityIds);

  const columns = entities.filter(isColumnEntity);
  if (columns.length === 0) return [];
  if (!columns.some((c) => movedSet.has(c.id))) return [];

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
