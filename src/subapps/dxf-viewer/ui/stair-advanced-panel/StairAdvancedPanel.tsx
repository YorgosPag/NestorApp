'use client';

/**
 * ADR-358 Phase 7b2a + 7b2b-α + 7.5 — Floating Advanced Properties panel.
 *
 * Pure presentational component: receives the selected `StairEntity` and a
 * patch dispatcher, composes the section stack:
 *   - Presets (7.5, Stream H — G26/Q32 library presets)
 *   - Materials (7b2a, Stream G item 1)
 *   - Per-Tread Overrides (7b2a, Stream G item 2)
 *   - Per-Riser Overrides (Q19 Φ7 — per-riser material)
 *   - Cut Plane Height (7b2a, Stream G item 3)
 *   - Tread Numbering (7b2b-α, Stream G item 4)
 *   - Nosing Side (7b2b-α, Stream G item 5)
 *   - Nosing Profile (Q19 Φ6 — per-tread bullnose/chamfer preset writer)
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
import type { LevelSceneWriter } from '../../systems/levels/level-scene-accessor';
import type { UseStairPersistenceResult } from '../../bim/hooks/use-stair-persistence';
import { StairWarningsSection } from './sections/StairWarningsSection';
import { StairPersistenceSection } from './sections/StairPersistenceSection';
import { StairPresetsSection } from './sections/StairPresetsSection';
import { StairMaterialsSection } from './sections/StairMaterialsSection';
import { StairPerTreadOverrideSection } from './sections/StairPerTreadOverrideSection';
import { StairPerRiserOverrideSection } from './sections/StairPerRiserOverrideSection';
import { StairCutPlaneSection } from './sections/StairCutPlaneSection';
import { StairTreadNumberingSection } from './sections/StairTreadNumberingSection';
import { StairTreadLabelSizeSection } from './sections/StairTreadLabelSizeSection';
import { StairNosingSection } from './sections/StairNosingSection';
import { StairTreadNosingProfileSection } from './sections/StairTreadNosingProfileSection';
import type { DispatchStairParamPatch } from './commands/dispatchStairParamPatch';

export interface StairAdvancedPanelProps {
  readonly stair: StairEntity;
  readonly dispatchPatch: DispatchStairParamPatch;
  readonly companyId: string | null;
  readonly userId: string | null;
  readonly projectId?: string;
  readonly levelManager: LevelSceneWriter;
  readonly persistence?: UseStairPersistenceResult;
  /**
   * Override container className (sidebar-tab mode passes a flow-layout
   * class; default keeps the legacy right-floating fixed position).
   */
  readonly containerClassName?: string;
  /** Hide the header (caller renders its own — e.g. tab label). */
  readonly hideHeader?: boolean;
}

export function StairAdvancedPanel({
  stair,
  dispatchPatch,
  companyId,
  userId,
  projectId,
  levelManager,
  persistence,
  containerClassName,
  hideHeader,
}: StairAdvancedPanelProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  const resolvedClassName =
    containerClassName
    ?? 'fixed right-4 top-20 z-40 flex w-80 max-h-[calc(100vh-6rem)] flex-col gap-3 overflow-y-auto rounded-lg border border-border bg-background/95 p-3 shadow-xl backdrop-blur';

  return (
    <aside
      aria-label={t('stairAdvancedPanel.title')}
      className={resolvedClassName}
    >
      {!hideHeader && (
        <header>
          <h3 className="text-sm font-medium text-foreground">
            {t('stairAdvancedPanel.title')}
          </h3>
        </header>
      )}
      <StairWarningsSection stair={stair} dispatchPatch={dispatchPatch} />
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
      <StairPerRiserOverrideSection stair={stair} dispatchPatch={dispatchPatch} />
      <StairCutPlaneSection stair={stair} dispatchPatch={dispatchPatch} />
      <StairTreadNumberingSection stair={stair} dispatchPatch={dispatchPatch} />
      <StairTreadLabelSizeSection stair={stair} dispatchPatch={dispatchPatch} />
      <StairNosingSection stair={stair} dispatchPatch={dispatchPatch} />
      <StairTreadNosingProfileSection stair={stair} dispatchPatch={dispatchPatch} />
    </aside>
  );
}
