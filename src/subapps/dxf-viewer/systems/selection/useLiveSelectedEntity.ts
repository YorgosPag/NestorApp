'use client';

/**
 * `useLiveSelectedEntity` — SSoT για «η ΖΩΝΤΑΝΗ οντότητα του primary selection»
 * ως render-time τιμή για ribbon widgets / properties panels.
 *
 * WHY (ADR-557 bug class, ξανά): ~7 ribbon widgets είχαν αντιγράψει το ίδιο
 * 8-γραμμο μπλοκ:
 *
 * ```ts
 * const entity = useMemo(() => {
 *   const id = universalSelection.getPrimaryId();
 *   if (!id || !levelManager.currentLevelId) return null;
 *   const scene = levelManager.getLevelScene(levelManager.currentLevelId);
 *   ...
 * }, [levelManager, universalSelection]);   // ← ΚΑΙ ΤΑ ΔΥΟ σταθερά refs
 * ```
 *
 * Το `levelManager` (context value του `LevelsSystem`) ΔΕΝ αλλάζει ταυτότητα σε
 * μετάβολή σκηνής — οι σκηνές ζουν στο `sceneManagerRef`/`SceneStore` και το
 * `getLevelScene` είναι `useCallback([])`. Άρα το memo **πάγωνε** το snapshot της
 * οντότητας από τη στιγμή του mount. Συνέπειες που είδε ο Giorgio (2026-07-20):
 *   - το πεδίο έδειχνε **μπαγιάτικη** τιμή, και
 *   - χειρότερα: το commit συνέθετε το patch πάνω στα ΠΑΓΩΜΕΝΑ params
 *     (`{ ...wall.params, ...patch }` στον `dispatchWallParamPatch`) → αλλάζοντας
 *     ΠΑΧΟΣ επανέγραφε το παλιό `end` (⇒ **επανέφερε το μήκος**) και αντίστροφα.
 *
 * Εδώ η ανάγνωση γίνεται μέσω των υπαρχόντων reactive SSoT: `usePrimarySelectedId`
 * (ADR-532 selection store) + `useSceneEntityById` (ADR-547 SceneStore selector,
 * reference-stable ανά οντότητα). Άρα: μηδέν πάγωμα, re-render ΜΟΝΟ όταν αλλάζει
 * αυτή η οντότητα ή το primary id (ADR-040 leaf-subscriber).
 *
 * @see systems/scene/useSceneSelectors.ts — ADR-547 reactive scene selectors
 * @see systems/selection/useSelectedEntities.ts — ADR-532 selection leaf hooks
 */

import { useLevelsOptional } from '../levels/useLevels';
import { useSceneEntityById } from '../scene/useSceneSelectors';
import { usePrimarySelectedId } from './useSelectedEntities';
import type { AnySceneEntity } from '../../types/scene';

/**
 * Η ζωντανή primary-selected οντότητα, **χωρίς** στένεμα τύπου — για καταναλωτές
 * που δέχονται οποιονδήποτε τύπο (π.χ. τα MEP widgets περνούν την οντότητα στο
 * `resolveManagedSystems`). `null` όταν δεν υπάρχει επιλογή ή ενεργό επίπεδο.
 */
export function useLivePrimaryEntity(): AnySceneEntity | null {
  const levels = useLevelsOptional();
  const primaryId = usePrimarySelectedId();
  return useSceneEntityById(levels?.currentLevelId ?? null, primaryId);
}

/**
 * Η ζωντανή primary-selected οντότητα, στενεμένη με `guard` (π.χ. `isWallEntity`).
 * `null` όταν δεν υπάρχει επιλογή, δεν υπάρχει ενεργό επίπεδο, ή ο τύπος δεν ταιριάζει.
 *
 * Πέρνα **σταθερό** (module-level) guard — μπαίνει σε deps του selector.
 */
export function useLiveSelectedEntity<T extends AnySceneEntity>(
  guard: (entity: AnySceneEntity) => entity is T,
): T | null {
  const entity = useLivePrimaryEntity();
  return entity && guard(entity) ? entity : null;
}
