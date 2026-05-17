'use client';

/**
 * ADR-358 Phase 7b2a + 7b2b-α + 7.5 — Floating Advanced Properties panel.
 *
 * Pure presentational component: receives the selected `StairEntity` and a
 * patch dispatcher, composes the section stack:
 *   - Presets (7.5, Stream H — G26/Q32 library presets)
 *   - Materials (7b2a, Stream G item 1)
 *   - Per-Tread Overrides (7b2a, Stream G item 2)
 *   - Cut Plane Height (7b2a, Stream G item 3)
 *   - Tread Numbering (7b2b-α, Stream G item 4)
 *   - Nosing Side (7b2b-α, Stream G item 5)
 *
 * Presets section sits first (industry convention: Revit Type Selector / ArchiCAD
 * Favorites at top of Properties palette). It receives auth + project context
 * separately because preset CRUD lives outside the per-stair param dispatcher.
 *
 * Positioning: floating fixed top-right, below the ribbon, width 320px.
 * Industry-aligned with Revit Properties Palette docked-right convention.
 * Drag-to-reposition deferred to Phase 7.5+.
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { StairEntity } from '../../types/entities';
import type { useLevels } from '../../systems/levels';
import type { UseStairPersistenceResult } from '../../hooks/data/useStairPersistence';
import { StairPersistenceSection } from './sections/StairPersistenceSection';
import { StairPresetsSection } from './sections/StairPresetsSection';
import { StairMaterialsSection } from './sections/StairMaterialsSection';
import { StairPerTreadOverrideSection } from './sections/StairPerTreadOverrideSection';
import { StairCutPlaneSection } from './sections/StairCutPlaneSection';
import { StairTreadNumberingSection } from './sections/StairTreadNumberingSection';
import { StairTreadLabelSizeSection } from './sections/StairTreadLabelSizeSection';
import { StairNosingSection } from './sections/StairNosingSection';
import type { DispatchStairParamPatch } from './commands/dispatchStairParamPatch';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

export interface StairAdvancedPanelProps {
  readonly stair: StairEntity;
  readonly dispatchPatch: DispatchStairParamPatch;
  readonly companyId: string | null;
  readonly userId: string | null;
  readonly projectId?: string;
  readonly levelManager: LevelManagerLike;
  readonly persistence?: UseStairPersistenceResult;
}

export function StairAdvancedPanel({
  stair,
  dispatchPatch,
  companyId,
  userId,
  projectId,
  levelManager,
  persistence,
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
      {persistence && (
        <StairPersistenceSection
          stair={stair}
          currentUserId={userId}
          persistence={persistence}
        />
      )}
      {companyId && userId && (
        <StairPresetsSection
          stair={stair}
          companyId={companyId}
          userId={userId}
          projectId={projectId}
          levelManager={levelManager}
        />
      )}
      <StairMaterialsSection stair={stair} dispatchPatch={dispatchPatch} />
      <StairPerTreadOverrideSection stair={stair} dispatchPatch={dispatchPatch} />
      <StairCutPlaneSection stair={stair} dispatchPatch={dispatchPatch} />
      <StairTreadNumberingSection stair={stair} dispatchPatch={dispatchPatch} />
      <StairTreadLabelSizeSection stair={stair} dispatchPatch={dispatchPatch} />
      <StairNosingSection stair={stair} dispatchPatch={dispatchPatch} />
    </aside>
  );
}
