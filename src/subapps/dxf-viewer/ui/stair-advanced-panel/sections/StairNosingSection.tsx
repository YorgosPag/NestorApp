'use client';

/**
 * ADR-358 Phase 7b2b-α — Stream G item 5: Nosing side selector (Q34).
 *
 * Combobox over `StairNosingSide` (`'front' | 'none' | 'front-and-sides'`).
 * Smart-default by `structureType` already lives in `useRibbonStairBridge`
 * (Phase 7a): cantilever/glass-tread/steel-grating → 'front-and-sides',
 * otherwise → 'front'. This panel surfaces the current value and lets the
 * user override explicitly (e.g. choose 'front-and-sides' on a monolithic
 * stair where the bridge defaulted to 'front').
 */

import React, { useCallback } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { StairEntity } from '../../../types/entities';
import type { StairNosingSide } from '../../../bim/types/stair-types';
import type { DispatchStairParamPatch } from '../commands/dispatchStairParamPatch';

const NOSING_OPTIONS: ReadonlyArray<{ readonly value: StairNosingSide; readonly labelKey: string }> = [
  { value: 'front', labelKey: 'stairAdvancedPanel.sections.nosingSide.options.front' },
  { value: 'none', labelKey: 'stairAdvancedPanel.sections.nosingSide.options.none' },
  { value: 'front-and-sides', labelKey: 'stairAdvancedPanel.sections.nosingSide.options.frontAndSides' },
];

const VALID_NOSING_SIDES: ReadonlySet<string> = new Set<StairNosingSide>([
  'front',
  'none',
  'front-and-sides',
]);

export interface StairNosingSectionProps {
  readonly stair: StairEntity;
  readonly dispatchPatch: DispatchStairParamPatch;
}

export function StairNosingSection({
  stair,
  dispatchPatch,
}: StairNosingSectionProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  const { nosingSide } = stair.params;

  const onChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const next = event.target.value;
      if (!VALID_NOSING_SIDES.has(next)) return;
      if (next === nosingSide) return;
      dispatchPatch(stair, { nosingSide: next as StairNosingSide });
    },
    [stair, dispatchPatch, nosingSide],
  );

  return (
    <section
      aria-label={t('stairAdvancedPanel.sections.nosingSide.title')}
      className="flex flex-col gap-2"
    >
      <header>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-300">
          {t('stairAdvancedPanel.sections.nosingSide.title')}
        </h4>
      </header>
      <label className="flex items-center gap-2 text-xs text-slate-200">
        <span className="w-32 shrink-0">
          {t('stairAdvancedPanel.sections.nosingSide.title')}
        </span>
        <select
          value={nosingSide}
          onChange={onChange}
          className="flex-1 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-100"
        >
          {NOSING_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {t(opt.labelKey)}
            </option>
          ))}
        </select>
      </label>
    </section>
  );
}
