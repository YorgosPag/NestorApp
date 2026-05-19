'use client';

/**
 * ADR-358 Phase 7b2b-α — Stream G item 4: Tread numbering (Q28).
 *
 * Surfaces three `StairParams` fields:
 *   - `treadLabelDisplay` ('all' | 'nth' | 'none') — radio (default 'none')
 *   - `treadLabelEveryN`  — numeric, visible only when display === 'nth'
 *   - `treadLabelRestartPerFlight` — toggle (default OFF; continuous 1→N,
 *     industry-aligned with Revit/ArchiCAD multi-flight numbering).
 *
 * Patch shape mirrors `dispatchStairParamPatch` shallow-merge contract: when
 * the user switches to 'nth' without a prior `treadLabelEveryN`, the patch
 * also seeds the default `EVERY_N_DEFAULT` so the renderer never sees a
 * `display='nth'` + `everyN===undefined` invalid pair.
 */

import React, { useCallback } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { StairEntity } from '../../../types/entities';
import type { StairTreadLabelDisplay } from '../../../bim/types/stair-types';
import type { DispatchStairParamPatch } from '../commands/dispatchStairParamPatch';

const EVERY_N_DEFAULT = 5;
const EVERY_N_MIN = 2;

const DISPLAY_MODES: ReadonlyArray<StairTreadLabelDisplay> = ['all', 'nth', 'none'];

export interface StairTreadNumberingSectionProps {
  readonly stair: StairEntity;
  readonly dispatchPatch: DispatchStairParamPatch;
}

export function StairTreadNumberingSection({
  stair,
  dispatchPatch,
}: StairTreadNumberingSectionProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  const { treadLabelDisplay, treadLabelEveryN, treadLabelRestartPerFlight } = stair.params;

  const onDisplayChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const next = event.target.value as StairTreadLabelDisplay;
      if (next === treadLabelDisplay) return;
      if (next === 'nth' && treadLabelEveryN === undefined) {
        dispatchPatch(stair, { treadLabelDisplay: 'nth', treadLabelEveryN: EVERY_N_DEFAULT });
        return;
      }
      dispatchPatch(stair, { treadLabelDisplay: next });
    },
    [stair, dispatchPatch, treadLabelDisplay, treadLabelEveryN],
  );

  const onEveryNChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const raw = event.target.value;
      if (raw === '') return;
      const num = Number.parseInt(raw, 10);
      if (!Number.isFinite(num) || num < EVERY_N_MIN) return;
      dispatchPatch(stair, { treadLabelEveryN: num });
    },
    [stair, dispatchPatch],
  );

  const onRestartToggle = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      dispatchPatch(stair, { treadLabelRestartPerFlight: event.target.checked });
    },
    [stair, dispatchPatch],
  );

  const showEveryN = treadLabelDisplay === 'nth';

  return (
    <section
      aria-label={t('stairAdvancedPanel.sections.treadNumbering.title')}
      className="flex flex-col gap-2"
    >
      <header>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-300">
          {t('stairAdvancedPanel.sections.treadNumbering.title')}
        </h4>
      </header>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="sr-only">
          {t('stairAdvancedPanel.sections.treadNumbering.title')}
        </legend>
        {DISPLAY_MODES.map((mode) => (
          <label key={mode} className="flex items-center gap-2 text-xs text-slate-200">
            <input
              type="radio"
              name="stair-tread-label-display"
              value={mode}
              checked={treadLabelDisplay === mode}
              onChange={onDisplayChange}
              className="h-3.5 w-3.5"
            />
            <span>{t(`stairAdvancedPanel.sections.treadNumbering.display.${mode}`)}</span>
          </label>
        ))}
      </fieldset>
      {showEveryN && (
        <label className="flex items-center gap-2 text-xs text-slate-200">
          <span className="w-32 shrink-0">
            {t('stairAdvancedPanel.sections.treadNumbering.everyN')}
          </span>
          <input
            type="number"
            min={EVERY_N_MIN}
            step={1}
            value={treadLabelEveryN ?? EVERY_N_DEFAULT}
            onChange={onEveryNChange}
            className="w-20 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-100"
          />
        </label>
      )}
      <label className="flex items-center gap-2 text-xs text-slate-200">
        <input
          type="checkbox"
          checked={treadLabelRestartPerFlight}
          onChange={onRestartToggle}
          className="h-3.5 w-3.5"
        />
        <span>{t('stairAdvancedPanel.sections.treadNumbering.restartPerFlight')}</span>
      </label>
    </section>
  );
}
