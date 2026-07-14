/**
 * ADR-656 M11 — useTopoGrid hook (the «Bake to drawing» export consumer).
 *
 * The presentation sibling of `useTopoContours` / `useTopoPointLabels`: read the survey points
 * from `TopoPointStore`, ensure the TOPO-GRID layer, build the ONE pure grid model over the
 * points' bounding box at the chosen fixed step, and commit the crosses + perimeter labels
 * through `completeEntities` (ADR-057) — so the baked grid lands on the current level with undo,
 * persistence, render and DXF/PDF export for free.
 *
 * The LIVE screen graticule is a separate concern (the canvas micro-leaf); this hook only bakes
 * the legal geometry into the drawing. Interactive bake = add-only (same contract as the siblings).
 */

import { useCallback } from 'react';
import { useLevels } from '../levels';
import { completeEntities } from '../../hooks/drawing/completeEntity';
import { realDistanceToModelMm } from '../../utils/scene-units';
import { getTopoPoints } from './TopoPointStore';
import { buildTopoGrid, type WorldRectMm } from './topo-grid-model';
import { buildTopoGridEntities } from './topo-grid-entities';
import { ensureGridLayer } from './ensure-grid-layers';
import { getGridDisplayOptions } from './topo-grid-store';
import type { Entity } from '../../types/entities';
import type { TopoPoint } from './topo-types';

export interface BakeGridOutcome {
  readonly ok: boolean;
  /** Number of grid entities (lines + labels) added to the scene. */
  readonly entityCount: number;
  /** Reason when `ok` is false (i18n key suffix under `topography.grid.error.*`). */
  readonly reason?: 'no-points' | 'no-layers' | 'empty-grid';
}

const EMPTY: BakeGridOutcome = { ok: false, entityCount: 0 };

export interface UseTopoGrid {
  readonly bake: (stepM?: number) => BakeGridOutcome;
}

/** Bounding box of the survey points in canonical mm, padded outward by one step. */
function paddedPointsRect(points: readonly TopoPoint[], stepMm: number): WorldRectMm {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX: minX - stepMm, minY: minY - stepMm, maxX: maxX + stepMm, maxY: maxY + stepMm };
}

export function useTopoGrid(): UseTopoGrid {
  const { currentLevelId, getLevelScene, setLevelScene } = useLevels();

  const bake = useCallback(
    (stepM: number = getGridDisplayOptions().exportStepM): BakeGridOutcome => {
      const levelId = currentLevelId || '0';
      const points = getTopoPoints();
      if (points.length === 0) return { ...EMPTY, reason: 'no-points' };

      const stepMm = realDistanceToModelMm(stepM, 'm');
      const grid = buildTopoGrid(paddedPointsRect(points, stepMm), stepMm);
      if (grid.crosses.length === 0) return { ...EMPTY, reason: 'empty-grid' };

      const layerId = ensureGridLayer(getLevelScene, setLevelScene, levelId);
      if (!layerId) return { ...EMPTY, reason: 'no-layers' };

      const entities = buildTopoGridEntities(grid, layerId);
      completeEntities(entities as Entity[], {
        tool: 'topo-grid',
        levelId,
        getScene: getLevelScene,
        setScene: setLevelScene,
      });

      return { ok: true, entityCount: entities.length };
    },
    [currentLevelId, getLevelScene, setLevelScene],
  );

  return { bake };
}
