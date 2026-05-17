'use client';

/**
 * ADR-358 Phase 7b1 + Phase 6.1 follow-up (2026-05-17) — surfacing of
 * `StairValidationState.violationKeys` to the user. The contextual ribbon
 * tab already raises a red "!" badge when `hasCodeViolations`; this section
 * complements the badge with a readable list of the actual violations so
 * the user knows WHAT is wrong, not just THAT something is wrong.
 *
 * Industry pattern (Revit "Warnings" section in Properties Palette,
 * ArchiCAD warnings dialog, AutoCAD Audit messages): each violation is a
 * single line; clicking a future "Fix" affordance is deferred to Phase 9.
 */

import React, { useCallback } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { StairEntity } from '../../../types/entities';
import type { DispatchStairParamPatch } from '../commands/dispatchStairParamPatch';
import { autoFixStairParams } from '../../../systems/stairs/stair-auto-fix';

export interface StairWarningsSectionProps {
  readonly stair: StairEntity;
  readonly dispatchPatch?: DispatchStairParamPatch;
}

export function StairWarningsSection({ stair, dispatchPatch }: StairWarningsSectionProps): React.ReactElement | null {
  const { t } = useTranslation(['dxf-viewer-shell', 'tool-hints']);
  const keys = stair.validation?.violationKeys ?? [];

  const onAutoFix = useCallback(() => {
    if (!dispatchPatch) return;
    const fixed = autoFixStairParams(stair.params);
    if (fixed === stair.params) return;
    dispatchPatch(stair, {
      rise: fixed.rise,
      tread: fixed.tread,
      width: fixed.width,
      stepCount: fixed.stepCount,
    });
  }, [stair, dispatchPatch]);

  if (keys.length === 0) return null;

  return (
    <section
      role="alert"
      aria-label={t('stairAdvancedPanel.sections.warnings.title')}
      className="flex flex-col gap-1.5 rounded border border-rose-600/40 bg-rose-900/20 p-2"
    >
      <header className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className="text-rose-300">!</span>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-rose-200">
            {t('stairAdvancedPanel.sections.warnings.title')}
          </h4>
        </span>
        {dispatchPatch && (
          <button
            type="button"
            onClick={onAutoFix}
            className="rounded border border-rose-500/60 bg-rose-700/50 px-2 py-1 text-xs font-medium text-rose-50 hover:bg-rose-600/70"
          >
            {t('stairAdvancedPanel.sections.warnings.autoFix')}
          </button>
        )}
      </header>
      <ul className="flex flex-col gap-1 text-xs text-rose-100">
        {keys.map((key) => {
          // Validator emits namespaced keys (e.g. `tools.stair.validator.…`)
          // resolved from the `tool-hints` namespace, plus shell-local keys
          // (`stairAdvancedPanel.…`). Force the namespace lookup so i18next
          // does not return the raw key when it is missing from the default
          // namespace.
          const ns = key.startsWith('tools.') ? 'tool-hints' : 'dxf-viewer-shell';
          return (
            <li key={key} className="leading-snug">
              {t(key, { ns, defaultValue: '' }) || key}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
