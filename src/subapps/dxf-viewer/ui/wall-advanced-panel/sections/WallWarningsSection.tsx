'use client';

/**
 * ADR-363 Phase 1D — Wall validation warnings section.
 *
 * Surfaces `WallEntity.validation.violationKeys` as a readable list, mirror
 * `StairWarningsSection` (ADR-358 Phase 7b1). Each violation key is an i18n
 * key under `tool-hints` (validator-emitted) or `dxf-viewer-shell`.
 *
 * Phase 1D scope: read-only display. Auto-fix affordance (parallel to
 * stair `autoFixStairParams`) lands when wall-auto-fix engine is added.
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { WallEntity } from '../../../bim/types/wall-types';

export interface WallWarningsSectionProps {
  readonly wall: WallEntity;
}

export function WallWarningsSection({
  wall,
}: WallWarningsSectionProps): React.ReactElement | null {
  const { t } = useTranslation(['dxf-viewer-shell', 'tool-hints']);
  const keys = wall.validation?.violationKeys ?? [];
  if (keys.length === 0) return null;

  return (
    <section
      role="alert"
      aria-label={t('wallAdvancedPanel.sections.warnings.title')}
      className="flex flex-col gap-1.5 rounded border border-amber-500/40 bg-amber-900/20 p-2"
    >
      <header className="flex items-center gap-2">
        <span aria-hidden="true" className="text-amber-300">
          !
        </span>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-amber-200">
          {t('wallAdvancedPanel.sections.warnings.title')}
        </h4>
      </header>
      <ul className="flex flex-col gap-1 text-xs text-amber-100">
        {keys.map((key) => {
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
