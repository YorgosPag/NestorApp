'use client';

/**
 * ADR-358 G21 (Phase 6+ brought forward 2026-05-17) — tread label text size.
 *
 * Surfaces `StairParams.treadLabelHeight` (scene-units, world-scaled) with a
 * user-facing **mm** numeric input. Internal value is converted between mm
 * and scene units using the same heuristic the geometry pipeline uses
 * (`params.width` magnitude → 'm' / 'cm' / 'mm').
 *
 * Range: 10 – 500 mm. Default seeded by `buildDefaultStairParams` (80 mm
 * scaled to scene units).
 */

import React, { useCallback, useMemo } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { StairEntity } from '../../../types/entities';
import type { DispatchStairParamPatch } from '../commands/dispatchStairParamPatch';

const HEIGHT_MIN_MM = 10;
const HEIGHT_MAX_MM = 500;
const HEIGHT_DEFAULT_MM = 80;
const HEIGHT_STEP_MM = 5;

export interface StairTreadLabelSizeSectionProps {
  readonly stair: StairEntity;
  readonly dispatchPatch: DispatchStairParamPatch;
}

/**
 * Mirror of `minWidthFloorFor` / `detectSceneUnits` heuristic: deduce the
 * scene-units mm scale factor from the current `width` value so the user
 * can type a mm number regardless of whether the scene is in m / cm / mm.
 */
function mmFactorFromWidth(width: number): number {
  if (!Number.isFinite(width) || width <= 0) return 1;
  if (width < 10) return 0.001;   // metres
  if (width < 100) return 0.1;    // centimetres
  return 1;                        // millimetres
}

export function StairTreadLabelSizeSection({
  stair,
  dispatchPatch,
}: StairTreadLabelSizeSectionProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  const { treadLabelHeight, width } = stair.params;

  const mmPerSceneUnit = useMemo(() => mmFactorFromWidth(width), [width]);

  const valueMm = useMemo(() => {
    if (typeof treadLabelHeight !== 'number') return HEIGHT_DEFAULT_MM;
    return Math.round(treadLabelHeight / mmPerSceneUnit);
  }, [treadLabelHeight, mmPerSceneUnit]);

  const onChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const raw = event.target.value;
      if (raw === '') return;
      const mm = Number.parseFloat(raw);
      if (!Number.isFinite(mm) || mm < HEIGHT_MIN_MM || mm > HEIGHT_MAX_MM) return;
      const sceneUnits = mm * mmPerSceneUnit;
      dispatchPatch(stair, { treadLabelHeight: sceneUnits });
    },
    [stair, dispatchPatch, mmPerSceneUnit],
  );

  return (
    <section
      aria-label={t('stairAdvancedPanel.sections.treadLabelSize.title')}
      className="flex flex-col gap-2"
    >
      <header>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('stairAdvancedPanel.sections.treadLabelSize.title')}
        </h4>
      </header>
      <label className="flex items-center gap-2 text-xs text-foreground">
        <span className="w-32 shrink-0">
          {t('stairAdvancedPanel.sections.treadLabelSize.height')}
        </span>
        <input
          type="number"
          min={HEIGHT_MIN_MM}
          max={HEIGHT_MAX_MM}
          step={HEIGHT_STEP_MM}
          value={valueMm}
          onChange={onChange}
          className="w-20 rounded border border-border bg-muted px-2 py-1 text-xs text-foreground"
        />
        <span className="text-muted-foreground">mm</span>
      </label>
    </section>
  );
}
