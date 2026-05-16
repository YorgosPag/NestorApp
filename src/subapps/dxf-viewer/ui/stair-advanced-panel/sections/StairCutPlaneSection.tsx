'use client';

/**
 * ADR-358 Phase 7b2a — Stream G item 3: Cut plane height (Q21).
 *
 * Project default 1200 mm + per-stair override. Toggle "Inherit from project"
 * → `cutPlaneHeight = undefined`. Toggle OFF → numeric input enabled, default
 * pre-fills with the project value so user starts from a sensible baseline.
 *
 * The project default is hardcoded here for Phase 7b2a (no project settings
 * SSoT for `dxf:project.cutPlaneHeight` yet — ADR-358 §9.2 Q21). Phase 8+
 * will swap this constant for a project-scoped setting read via context.
 */

import React, { useCallback } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { StairEntity } from '../../../types/entities';
import type { DispatchStairParamPatch } from '../commands/dispatchStairParamPatch';

const PROJECT_DEFAULT_CUT_PLANE_MM = 1200;

export interface StairCutPlaneSectionProps {
  readonly stair: StairEntity;
  readonly dispatchPatch: DispatchStairParamPatch;
}

export function StairCutPlaneSection({
  stair,
  dispatchPatch,
}: StairCutPlaneSectionProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  const value = stair.params.cutPlaneHeight;
  const inherits = value === undefined;

  const onInheritToggle = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const nextInherit = event.target.checked;
      if (nextInherit) {
        dispatchPatch(stair, { cutPlaneHeight: undefined });
        return;
      }
      dispatchPatch(stair, { cutPlaneHeight: PROJECT_DEFAULT_CUT_PLANE_MM });
    },
    [stair, dispatchPatch],
  );

  const onOverrideChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const raw = event.target.value;
      if (raw === '') return;
      const num = Number.parseFloat(raw);
      if (Number.isNaN(num) || num <= 0) return;
      dispatchPatch(stair, { cutPlaneHeight: num });
    },
    [stair, dispatchPatch],
  );

  return (
    <section
      aria-label={t('stairAdvancedPanel.sections.cutPlane.title')}
      className="flex flex-col gap-2"
    >
      <header>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-300">
          {t('stairAdvancedPanel.sections.cutPlane.title')}
        </h4>
      </header>
      <label className="flex items-center gap-2 text-xs text-slate-200">
        <input
          type="checkbox"
          checked={inherits}
          onChange={onInheritToggle}
          className="h-3.5 w-3.5"
        />
        <span>{t('stairAdvancedPanel.sections.cutPlane.inheritProject')}</span>
      </label>
      <p className="text-[11px] italic text-slate-500">
        {t('stairAdvancedPanel.sections.cutPlane.projectDefaultHint', {
          valueMm: PROJECT_DEFAULT_CUT_PLANE_MM,
        })}
      </p>
      <label className="flex items-center gap-2 text-xs text-slate-200">
        <span className="w-32 shrink-0">
          {t('stairAdvancedPanel.sections.cutPlane.overrideMm')}
        </span>
        <input
          type="number"
          min={1}
          step={50}
          value={inherits ? '' : value}
          disabled={inherits}
          onChange={onOverrideChange}
          className="w-24 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-100 disabled:opacity-40"
        />
      </label>
    </section>
  );
}
