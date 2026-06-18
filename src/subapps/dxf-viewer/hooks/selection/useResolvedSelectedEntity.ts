'use client';

/**
 * useResolvedSelectedEntity — reactive hook wrapper του `resolveSelectedEntityFrom`
 * SSoT (ADR-484 — cross-level foundation properties).
 *
 * Reused από ΟΛΟΥΣ τους consumers του primary-selected entity (Properties shell +
 * router + foundation tab + contextual ribbon resolver) ώστε ένα cross-level πέδιλο
 * να εμφανίζει ιδιότητες + contextual tab ΑΚΡΙΒΩΣ όπως ένα active-level entity.
 *
 * Πηγή των cross-level footings = το low-freq `foundation-level-store` (γράφεται
 * μόνο σε αλλαγή ορόφου/δομική μεταβολή). Είναι **ADR-040-safe**: ΔΕΝ είναι
 * high-freq store (hover/cursor/transform), άρα η subscription εδώ δεν παραβιάζει
 * τον micro-leaf κανόνα — μηδέν 60fps re-renders. Reactive ώστε ένα cross-level
 * param edit να ανανεώνει το panel.
 *
 * @see ../../systems/selection/resolve-selected-entity.ts — ο pure resolver
 * @see ../../state/foundation-level-store.ts — η πηγή (low-freq)
 */

import { useMemo } from 'react';
import type { Entity } from '../../types/entities';
import type { SceneModel } from '../../types/scene';
import { useFoundationLevelStore } from '../../state/foundation-level-store';
import { resolveSelectedEntityFrom } from '../../systems/selection/resolve-selected-entity';

export function useResolvedSelectedEntity(
  primarySelectedId: string | null,
  currentScene: SceneModel | null,
): Entity | null {
  const crossLevelEntities = useFoundationLevelStore((s) => s.entities);
  return useMemo(
    () =>
      resolveSelectedEntityFrom(
        primarySelectedId,
        currentScene?.entities,
        crossLevelEntities,
      ),
    [primarySelectedId, currentScene, crossLevelEntities],
  );
}
