'use client';

/**
 * ADR-358 Phase Q17 9B-4 — Stair contextual ribbon: dimensions read-out.
 *
 * Surfaces the derived stair dimensions (μήκος = totalRun, συνολικό ύψος =
 * totalRise) as a read-only widget so the engineer can verify the planar
 * length and the floor-to-floor rise without opening the floating Advanced
 * Properties panel. Industry pattern (Revit "Dimensions" Properties section,
 * ArchiCAD Stair settings "Tread Number/Run" panel, AutoCAD Architecture
 * "Calculated" group): live read-out next to the editable geometry inputs.
 *
 * Unit conventions:
 *   - `StairParams.totalRun` / `totalRise` are stored in scene units
 *     (mm / cm / m depending on the host scene's `$INSUNITS`).
 *   - Display is always meters with 2-decimal precision — the engineer
 *     thinks in m for building-scale lengths.
 *   - Conversion uses the same `mmFactorFromWidth` heuristic as the rest of
 *     the stair pipeline (validator / auto-fix / grips / floor-link), so
 *     the read-out matches the values the validator + grips reason about.
 *
 * ADR-040 micro-leaf compliance: the widget consumes the selection +
 * level-scene store at the leaf, never at the orchestrator panel.
 */

import React, { useMemo } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useLevels } from '../../../systems/levels';
import { useUniversalSelection } from '../../../systems/selection';
import { isStairEntity } from '../../../types/entities';
import type { StairEntity } from '../../../types/entities';
import { mmFactorFromWidth } from '../../../systems/stairs/stair-floor-link';

const MM_PER_M = 1000;

function formatMeters(valueMm: number | null): string {
  if (valueMm === null || !Number.isFinite(valueMm)) return '—';
  return `${(valueMm / MM_PER_M).toFixed(2)} m`;
}

export function RibbonStairDimensionsWidget(): React.JSX.Element {
  const { t } = useTranslation('dxf-viewer-shell');
  const levelManager = useLevels();
  const universalSelection = useUniversalSelection();

  const stair = useMemo<StairEntity | null>(() => {
    const id = universalSelection.getPrimaryId();
    if (!id || !levelManager.currentLevelId) return null;
    const scene = levelManager.getLevelScene(levelManager.currentLevelId);
    if (!scene) return null;
    const e = scene.entities.find((x) => x.id === id);
    if (!e || !isStairEntity(e)) return null;
    return e;
  }, [levelManager, universalSelection]);

  if (!stair) {
    return (
      <span className="dxf-ribbon-stair-floor-info">
        <span className="dxf-ribbon-stair-floor-value">—</span>
      </span>
    );
  }

  const mmPerSceneUnit = mmFactorFromWidth(stair.params.width);
  const totalRunMm = stair.params.totalRun * mmPerSceneUnit;
  const totalRiseMm = stair.params.totalRise * mmPerSceneUnit;

  return (
    <span className="dxf-ribbon-stair-floor-info">
      <span className="dxf-ribbon-stair-floor-grid">
        <span className="dxf-ribbon-stair-floor-row">
          <span className="dxf-ribbon-stair-floor-label">
            {t('ribbon.commands.stairEditor.dimensions.length')}
          </span>
          <span className="dxf-ribbon-stair-floor-value">
            {formatMeters(totalRunMm)}
          </span>
        </span>
        <span className="dxf-ribbon-stair-floor-row">
          <span className="dxf-ribbon-stair-floor-label">
            {t('ribbon.commands.stairEditor.dimensions.totalRise')}
          </span>
          <span className="dxf-ribbon-stair-floor-value">
            {formatMeters(totalRiseMm)}
          </span>
        </span>
      </span>
    </span>
  );
}
