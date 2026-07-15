/**
 * ADR-656 M12 — useNorthArrow hook (the «Bake to drawing» export consumer).
 *
 * The sibling of `useTopoGrid`: read the survey points, compute the display-frame north angle
 * (Grid / True) from the ONE `north-arrow-model`, ensure the TOPO-NORTH layer, and commit the
 * arrow + «Β» glyph through `completeEntities` (ADR-057) — undo / persistence / render / export
 * for free. The anchor is the top-right of the survey, projected into the display frame so it
 * lands correctly whether or not the project is geo-referenced.
 */

import { useCallback } from 'react';
import { useLevels } from '../levels';
import { completeEntities } from '../../hooks/drawing/completeEntity';
import { getTopoPoints } from './TopoPointStore';
import { getGeoReference, getActiveWorldToDisplayProjector } from '../geo-referencing/geo-reference-store';
import { northAngleDeg, surveyCentroidEN } from './north-arrow-model';
import { buildNorthArrowEntities } from './north-arrow-entities';
import { ensureNorthLayer } from './ensure-north-layer';
import { getNorthArrowOptions } from './north-arrow-store';
import { TOPO_NORTH_WORLD_HEIGHT_MM, type NorthMode } from './north-arrow-config';
import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import type { TopoPoint } from './topo-types';

export interface BakeNorthOutcome {
  readonly ok: boolean;
  readonly entityCount: number;
  readonly reason?: 'no-points' | 'no-layers' | 'already-exists';
}

const EMPTY: BakeNorthOutcome = { ok: false, entityCount: 0 };

export interface UseNorthArrow {
  readonly bake: (mode?: NorthMode) => BakeNorthOutcome;
}

/** Top-right of the survey bbox, plus a one-arrow-height margin (ΕΓΣΑ world mm). */
function topRightAnchorWorld(points: readonly TopoPoint[]): Point2D {
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { x: maxX + TOPO_NORTH_WORLD_HEIGHT_MM, y: maxY + TOPO_NORTH_WORLD_HEIGHT_MM };
}

export function useNorthArrow(): UseNorthArrow {
  const { currentLevelId, getLevelScene, setLevelScene } = useLevels();

  const bake = useCallback(
    (mode: NorthMode = getNorthArrowOptions().mode): BakeNorthOutcome => {
      const levelId = currentLevelId || '0';
      const points = getTopoPoints();
      if (points.length === 0) return { ...EMPTY, reason: 'no-points' };

      const geo = getGeoReference();
      const angle = northAngleDeg(mode, geo, surveyCentroidEN(points));
      const aw = topRightAnchorWorld(points);
      const anchor = getActiveWorldToDisplayProjector().project(aw.x, aw.y);

      const layerId = ensureNorthLayer(getLevelScene, setLevelScene, levelId);
      if (!layerId) return { ...EMPTY, reason: 'no-layers' };

      // Idempotent: the north arrow is a SINGLETON symbol (one per drawing). If a baked arrow
      // already lives on TOPO-NORTH, do NOT create a duplicate — even after the user has MOVED
      // it (the presence check is layer-based, not position-based, so a relocated arrow survives).
      // To re-place, the user deletes the existing arrow (the layer empties) and bakes again.
      if (getLevelScene(levelId)?.entities.some((e) => e.layerId === layerId)) {
        return { ...EMPTY, reason: 'already-exists' };
      }

      const entities = buildNorthArrowEntities(anchor, angle, layerId);
      completeEntities(entities as Entity[], {
        tool: 'topo-north',
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
