/**
 * move-clearance-dims — SSoT: κυανές neighbor-clearance listening dimensions για ένα entity που
 * ΜΕΤΑΚΙΝΕΙΤΑΙ (2-click Move / body-drag), ADR-508 §neighbor-clearance.
 *
 * Twin του placement (`placement-ghost-assembly`): εκεί ένα ΝΕΟ ghost δείχνει clearance προς τους
 * γείτονες· εδώ ένα ΥΠΑΡΧΟΝ entity στη destination θέση δείχνει τα ίδια. Reuse ΟΛΗ τη μηχανή
 * (`resolveNeighborClearanceDims` + `collectSceneSnapTargets` + `resolveEntityFootprintForDims`) —
 * ΜΗΔΕΝ νέα γεωμετρία, ίδιες `GHOST_DIM_*` παράμετροι με το placement → ίδια οπτική.
 *
 * Self-exclusion: τα κινούμενα entities εξαιρούνται από τους στόχους (αλλιώς μετριέται clearance
 * προς τον εαυτό / την αρχική θέση). Τα targets είναι ακριβά (`collectSceneSnapTargets` σαρώνει όλη
 * τη σκηνή) → memoised ανά drag: όσο το scene array ref + το κινούμενο set μένουν σταθερά (καθ' όλο
 * το σύρσιμο) γίνεται ΕΝΑ collect (ADR-040 — draw-time hot path).
 *
 * Pure-ish — zero React/DOM/THREE· μόνο ένα module-level memo για το target collection.
 *
 * @see ./neighbor-clearance-dims.ts — resolveNeighborClearanceDims (η μηχανή)
 * @see ./entity-footprint-for-dims.ts — footprint ανά entity type
 * @see ../placement/placement-ghost-assembly.ts — ο αδελφός (τοποθέτηση νέου μέλους)
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import type { SceneUnits } from '../../utils/scene-units';
import type { GhostFaceDimensionsMeta } from './ghost-face-dim-references';
import type { SceneSnapTargets } from './scene-snap-targets';
import { collectSceneSnapTargets } from './scene-snap-targets';
import { resolveClearanceDimsForGhost } from './clearance-dims';
import { resolveEntityFootprintForDims } from './entity-footprint-for-dims';
import { translatePoints } from '../../rendering/entities/shared/geometry-vector-utils';

interface TargetsCache {
  readonly scene: readonly Entity[];
  readonly movingKey: string;
  readonly targets: SceneSnapTargets;
}
let _cache: TargetsCache | null = null;

/** Scene targets ΧΩΡΙΣ τα κινούμενα entities, memoised όσο (scene ref, moving set) μένουν ίδια. */
function selfExcludedTargets(sceneEntities: readonly Entity[], movingIds: ReadonlySet<string>): SceneSnapTargets {
  const movingKey = [...movingIds].sort().join(',');
  if (_cache && _cache.scene === sceneEntities && _cache.movingKey === movingKey) return _cache.targets;
  const targets = collectSceneSnapTargets(sceneEntities.filter((e) => !movingIds.has(e.id)));
  _cache = { scene: sceneEntities, movingKey, targets };
  return targets;
}

/**
 * Οι κυανές clearance dims για το `baseEntity` μετατοπισμένο κατά `delta` (destination θέση), ή
 * `null` όταν δεν έχει footprint με νόημα ή κανένας γείτονας εντός ορίων. `movingIds` = ΟΛΑ τα
 * entities του τρέχοντος gesture (self-exclusion). `wpp` = world-units ανά screen pixel (zoom).
 */
export function resolveMoveClearanceDims(
  baseEntity: Entity,
  delta: Point2D,
  movingIds: ReadonlySet<string>,
  sceneEntities: readonly Entity[],
  sceneUnits: SceneUnits,
  wpp: number,
): GhostFaceDimensionsMeta | null {
  const base = resolveEntityFootprintForDims(baseEntity);
  if (!base) return null;
  const footprint = translatePoints(base, delta);
  const targets = selfExcludedTargets(sceneEntities, movingIds);
  // ΚΟΙΝΟΣ SSoT (ίδια metrics με το placement) — μηδέν inline opts εδώ.
  return resolveClearanceDimsForGhost(footprint, targets, sceneUnits, wpp);
}

/**
 * ΕΝΑΣ entry point για ΟΛΕΣ τις ροές μετακίνησης (2-click Move + body-drag): επιλέγει το footprint
 * του «κύριου» κινούμενου entity (πρώτο της επιλογής), εξαιρεί ΟΛΑ τα κινούμενα ως στόχους, και
 * παράγει τις κυανές clearance dims. Ο caller δίνει μόνο τον lookup + τη λίστα ids + delta →
 * μηδέν διπλό glue ανά gesture (ΜΙΑ πηγή αλήθειας για «κυανές κατά τη μετακίνηση»).
 */
export function resolveMoveClearanceForSelection(
  getEntity: (id: string) => Entity | null,
  movingIds: readonly string[],
  delta: Point2D,
  sceneEntities: readonly Entity[],
  sceneUnits: SceneUnits,
  wpp: number,
): GhostFaceDimensionsMeta | null {
  const firstId = movingIds[0];
  if (!firstId) return null;
  const baseEntity = getEntity(firstId);
  if (!baseEntity) return null;
  return resolveMoveClearanceDims(baseEntity, delta, new Set(movingIds), sceneEntities, sceneUnits, wpp);
}
