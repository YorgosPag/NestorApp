'use client';

/**
 * ADR-358 Phase 7b2a + 7b2b-α — Floating Advanced Properties panel.
 *
 * Pure presentational component: receives the selected `StairEntity` and a
 * patch dispatcher, composes the section stack:
 *   - Materials (7b2a, Stream G item 1)
 *   - Per-Tread Overrides (7b2a, Stream G item 2)
 *   - Cut Plane Height (7b2a, Stream G item 3)
 *   - Tread Numbering (7b2b-α, Stream G item 4)
 *   - Nosing Side (7b2b-α, Stream G item 5)
 *
 * Positioning: floating fixed top-right, below the ribbon, width 320px.
 * Industry-aligned with Revit Properties Palette docked-right convention.
 * Drag-to-reposition deferred to Phase 7.5+.
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { StairEntity } from '../../types/entities';
import { StairMaterialsSection } from './sections/StairMaterialsSection';
import { StairPerTreadOverrideSection } from './sections/StairPerTreadOverrideSection';
import { StairCutPlaneSection } from './sections/StairCutPlaneSection';
import { StairTreadNumberingSection } from './sections/StairTreadNumberingSection';
import { StairNosingSection } from './sections/StairNosingSection';
import type { DispatchStairParamPatch } from './commands/dispatchStairParamPatch';

export interface StairAdvancedPanelProps {
  readonly stair: StairEntity;
  readonly dispatchPatch: DispatchStairParamPatch;
}

export function StairAdvancedPanel({
  stair,
  dispatchPatch,
}: StairAdvancedPanelProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');

  return (
    <aside
      aria-label={t('stairAdvancedPanel.title')}
      className="fixed right-4 top-20 z-40 flex w-80 max-h-[calc(100vh-6rem)] flex-col gap-3 overflow-y-auto rounded-lg border border-slate-700 bg-slate-900/95 p-3 shadow-xl backdrop-blur"
    >
      <header>
        <h3 className="text-sm font-medium text-slate-100">
          {t('stairAdvancedPanel.title')}
        </h3>
      </header>
      <StairMaterialsSection stair={stair} dispatchPatch={dispatchPatch} />
      <StairPerTreadOverrideSection stair={stair} dispatchPatch={dispatchPatch} />
      <StairCutPlaneSection stair={stair} dispatchPatch={dispatchPatch} />
      <StairTreadNumberingSection stair={stair} dispatchPatch={dispatchPatch} />
      <StairNosingSection stair={stair} dispatchPatch={dispatchPatch} />
    </aside>
  );
}
