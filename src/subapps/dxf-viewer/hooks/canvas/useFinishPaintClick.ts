'use client';

/**
 * useFinishPaintClick — ADR-449 PART B Slice C (2D) «Βαφή σοβά» canvas click wiring.
 *
 * Επιστρέφει έναν click handler για όσο είναι ενεργό το εργαλείο `finish-paint`: ένα κλικ σε
 * όψη σοβά στην 2D κάτοψη → βάφεται με το τρέχον πινέλο (`getFinishPaintBrush`). Ο handler
 * καλείται από το `useCanvasClickHandler` (intercept ΠΡΙΝ grips/selection) και **καταναλώνει**
 * το κλικ (το εργαλείο είναι category `'drawing'` → `isInDrawingMode` → το mouse-up skip-άρει
 * την επιλογή entity, άρα η κολόνα δεν επιλέγεται ενώ βάφεις). Paintbrush = μένει armed για
 * πολλές όψεις (ο handler δεν αλλάζει tool).
 *
 * Ζει εδώ (hooks layer) γιατί γεφυρώνει τον pure resolver (`bim/finishes`) με τον κοινό
 * apply SSoT (`bim-3d/ui`) + το πλήρες `LevelsHookReturn` write path — μηδέν διπλό write path,
 * μηδέν `as` (το `levelManager` του CanvasSection είναι το πλήρες `useLevels()`).
 *
 * ADR-040: event-time reads (`getFinishPaintBrush()` getter, `getImmediateTransform()`) — καμία
 * subscription στον orchestrator.
 *
 * @see ../../bim/finishes/finish-paint-target-2d — pure pick → {bimId, faceKey}
 * @see ../../bim-3d/ui/apply-finish-face-override — κοινός undoable writer (2D+3D)
 * @see ../../bim/finishes/finish-paint-brush-store — τρέχον πινέλο
 * @see docs/centralized-systems/reference/adrs/ADR-449-structural-finish-skin.md §PART B
 */

import { useCallback } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { LevelsHookReturn } from '../../systems/levels/useLevels';
import { resolveSceneUnits, mmToSceneUnits } from '../../utils/scene-units';
import { worldPerPixel } from '../../rendering/utils/viewport-scale';
import { getImmediateTransform } from '../../systems/cursor/ImmediateTransformStore';
import { resolveFinishPaintTarget } from '../../bim/finishes/finish-paint-target-2d';
import { getFinishPaintBrush } from '../../bim/finishes/finish-paint-brush-store';
import { applyFinishFaceOverrideToFaces } from '../../bim-3d/ui/apply-finish-face-override';

/** Click margin σε pixels γύρω από τη λωρίδα σοβά (world = px × worldPerPixel), forgiving pick. */
const CLICK_TOL_PX = 4;

/**
 * Δίνει τον `finish-paint` click handler. Καλείται μόνο όταν `activeTool === 'finish-paint'`.
 * `true` → βάφτηκε όψη (κατανάλωσε το κλικ)· `false` → καμία όψη κάτω από τον κέρσορα.
 */
export function useFinishPaintClick(
  levelManager: LevelsHookReturn,
): (worldPoint: Point2D) => boolean {
  return useCallback((worldPoint: Point2D): boolean => {
    const levelId = levelManager.currentLevelId;
    const scene = levelId ? levelManager.getLevelScene(levelId) : null;
    if (!scene) return false;
    const scale = mmToSceneUnits(resolveSceneUnits(scene));
    const tolWorld = CLICK_TOL_PX * worldPerPixel(getImmediateTransform().scale);
    const target = resolveFinishPaintTarget(worldPoint, scene.entities, scale, tolWorld);
    if (!target) return false;
    applyFinishFaceOverrideToFaces(levelManager, [target], getFinishPaintBrush());
    return true;
  }, [levelManager]);
}
