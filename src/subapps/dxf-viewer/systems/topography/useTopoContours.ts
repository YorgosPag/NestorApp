/**
 * ADR-650 Milestone 1 — useTopoContours hook.
 *
 * Wires the deterministic core to the live drawing surface: read the survey points from
 * `TopoPointStore`, run the CDT → marching → chain pipeline, ensure the contour layers,
 * and commit the resulting entities through the ADR-057 `completeEntities` SSoT — then seat
 * the whole set at the BACK of the render list (behind the κάτοψη) via ONE atomic
 * `BatchReorderEntityCommand` (ADR-661), so the contours land with undo/persistence/render/
 * selection for free AND read as topographic background context on top of which the plan sits.
 *
 * "Auto path" (Q4): one call generates everything; the guided/manual+AI modes are later.
 */

import { useCallback } from 'react';
import { useLevels } from '../levels';
import { completeEntities } from '../../hooks/drawing/completeEntity';
import { BatchReorderEntityCommand } from '../../core/commands/entity-commands';
import { getGlobalCommandHistory } from '../../core/commands/CommandHistory';
import { createLevelSceneManagerAdapter } from '../entity-creation/LevelSceneManagerAdapter';
import { getTopoPoints } from './TopoPointStore';
import { getTopoSurface } from './topo-surface';
import { generateContoursFromSurface } from './contour-generator';
import { buildContourEntities } from './topo-to-entities';
import { ensureContourLayers } from './ensure-contour-layers';
import { getContourDisplayStyle } from './contour-display-store';
import { DEFAULT_CONTOUR_CONFIG, type ContourConfig } from './contour-config';
import type { Entity } from '../../types/entities';

export interface GenerateContoursOutcome {
  readonly ok: boolean;
  /** Number of contour entities (lwpolylines + labels) added to the scene. */
  readonly entityCount: number;
  /** Number of contour lines produced (polylines only). */
  readonly contourCount: number;
  /** Reason when `ok` is false (i18n key suffix under `topography.error.*`). */
  readonly reason?: 'no-level' | 'too-few-points' | 'no-contours' | 'no-layers';
}

const EMPTY: GenerateContoursOutcome = { ok: false, entityCount: 0, contourCount: 0 };

export interface UseTopoContours {
  readonly generate: (config?: ContourConfig) => GenerateContoursOutcome;
}

export function useTopoContours(): UseTopoContours {
  const { currentLevelId, getLevelScene, setLevelScene } = useLevels();

  const generate = useCallback(
    (config: ContourConfig = DEFAULT_CONTOUR_CONFIG): GenerateContoursOutcome => {
      const levelId = currentLevelId || '0';
      const points = getTopoPoints();
      if (points.length < 3) return { ...EMPTY, reason: 'too-few-points' };

      // ADR-650 M4 — contour the ONE memoised surface (same instance the 3D terrain renders).
      const { contours } = generateContoursFromSurface(getTopoSurface(), config);
      if (contours.length === 0) return { ...EMPTY, reason: 'no-contours' };

      const layers = ensureContourLayers(getLevelScene, setLevelScene, levelId);
      if (!layers) return { ...EMPTY, reason: 'no-layers' };

      // ADR-650 M3 — new contours inherit the current display style (exact/smooth);
      // their vertices are the EXACT surveyed crossings either way.
      const smoothDisplay = getContourDisplayStyle() === 'smooth';
      const entities = buildContourEntities(contours, config, layers, smoothDisplay);
      // ADR-661 — create through the ADR-057 SSoT (ids preserved via `existingId`), THEN seat the
      // whole contour set at the BACK in ONE atomic reorder so the κάτοψη reads on top. Reuses
      // `completeEntities` (no create-logic clone — N.18); the DURABLE back-seat for every
      // load/level-switch/geo-ref lives in `regenerate-topo` (`[...fresh, ...kept]`).
      completeEntities(entities as Entity[], {
        tool: 'topo-contours',
        levelId,
        getScene: getLevelScene,
        setScene: setLevelScene,
      });
      const adapter = createLevelSceneManagerAdapter(getLevelScene, setLevelScene, levelId);
      getGlobalCommandHistory().execute(
        new BatchReorderEntityCommand(entities.map((e) => e.id), 'back', adapter),
      );

      return { ok: true, entityCount: entities.length, contourCount: contours.length };
    },
    [currentLevelId, getLevelScene, setLevelScene],
  );

  return { generate };
}
