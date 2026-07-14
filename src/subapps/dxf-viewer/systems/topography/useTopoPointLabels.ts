/**
 * ADR-656 M10 — useTopoPointLabels hook.
 *
 * The presentation sibling of `useTopoContours`: read the survey points + boundary from
 * `TopoPointStore`, sample the ONE derived surface for boundary Z, ensure the point-label
 * layers, and commit the label entities through `completeEntities` (ADR-057) — so the labels
 * land on the current level with undo, persistence, render and selection for free.
 *
 * Interactive path (like `useTopoContours.generate`): add-only. The idempotent silent
 * regenerate-on-load is a future parity item (mirrors `regenerate-topo.ts`), not M10.
 */

import { useCallback } from 'react';
import { useLevels } from '../levels';
import { completeEntities } from '../../hooks/drawing/completeEntity';
import { getTopoPoints, getTopoBoundary } from './TopoPointStore';
import { getTopoSurface } from './topo-surface';
import { createTinSampler } from './tin-sampler';
import { buildSurveyPointLabelEntities } from './topo-point-labels';
import { ensurePointLabelLayers } from './ensure-point-label-layers';
import { getPointLabelOptions } from './topo-point-label-store';
import { DEFAULT_POINT_LABEL_OPTS, type PointLabelOptions } from './topo-point-label-config';
import type { Entity } from '../../types/entities';

export interface GeneratePointLabelsOutcome {
  readonly ok: boolean;
  /** Number of label entities (text + point nodes) added to the scene. */
  readonly entityCount: number;
  /** Reason when `ok` is false (i18n key suffix under `topography.error.*`). */
  readonly reason?: 'no-points' | 'nothing-selected' | 'no-layers';
}

const EMPTY: GeneratePointLabelsOutcome = { ok: false, entityCount: 0 };

export interface UseTopoPointLabels {
  readonly generate: (opts?: PointLabelOptions) => GeneratePointLabelsOutcome;
}

export function useTopoPointLabels(): UseTopoPointLabels {
  const { currentLevelId, getLevelScene, setLevelScene } = useLevels();

  const generate = useCallback(
    (opts: PointLabelOptions = DEFAULT_POINT_LABEL_OPTS): GeneratePointLabelsOutcome => {
      const levelId = currentLevelId || '0';
      const points = getTopoPoints();
      if (points.length === 0) return { ...EMPTY, reason: 'no-points' };
      if (!opts.showElevation && !opts.showPointNumberCode && !opts.showBoundaryXy) {
        return { ...EMPTY, reason: 'nothing-selected' };
      }

      const layers = ensurePointLabelLayers(getLevelScene, setLevelScene, levelId);
      if (!layers) return { ...EMPTY, reason: 'no-layers' };

      // ADR-656 M10 — boundary Z is sampled from the ONE memoised surface (same instance the
      // contours and volumes read), never a second triangulation.
      const sampler = createTinSampler(getTopoSurface());
      const boundary = getTopoBoundary();
      const entities = buildSurveyPointLabelEntities(
        points, boundary?.vertices ?? null, sampler, layers, opts,
      );

      completeEntities(entities as Entity[], {
        tool: 'topo-point-labels',
        levelId,
        getScene: getLevelScene,
        setScene: setLevelScene,
      });

      return { ok: true, entityCount: entities.length };
    },
    [currentLevelId, getLevelScene, setLevelScene],
  );

  return { generate };
}
