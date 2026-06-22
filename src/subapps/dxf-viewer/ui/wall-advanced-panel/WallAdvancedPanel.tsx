'use client';

/**
 * ADR-363 Phase 1D — Wall Advanced Properties panel ("Σύνθεση Στρώσεων").
 *
 * Floating panel hosted by `WallPropertiesTab` inside the sidebar's third
 * tab. Mirror `StairAdvancedPanel` (ADR-358 Phase 7b2a). Pure presentational
 * — wires section stack against a single `dispatchPatch` writer (SSoT to
 * `UpdateWallParamsCommand`) and optional persistence binding.
 *
 * Sections:
 *   - WallWarningsSection (validation surfaces)
 *   - WallPersistenceSection (G24 soft-lock + saveNow button)
 *   - WallDnaSection (Σύνθεση Στρώσεων — main feature)
 *
 * Phase 1D leaves materials catalog as a stub (hardcoded presets) — Phase 6+
 * swaps the catalog provider with a Firestore-backed Asset Manager.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §6 Phase 1D
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { WallEntity } from '../../bim/types/wall-types';
import type { useLevels } from '../../systems/levels';
import type { UseWallPersistenceResult } from '../../hooks/data/useWallPersistence';
import { WallWarningsSection } from './sections/WallWarningsSection';
import { WallPersistenceSection } from './sections/WallPersistenceSection';
import { WallDraftSaveTypeSection } from './sections/WallDraftSaveTypeSection';
import { WallDnaSection } from './sections/WallDnaSection';
import type { DispatchWallParamPatch } from './commands/dispatchWallParamPatch';
import { useDnaMaterialOptions } from './hooks/useDnaMaterialOptions';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

export interface WallAdvancedPanelProps {
  readonly wall: WallEntity;
  readonly dispatchPatch: DispatchWallParamPatch;
  readonly userId: string | null;
  readonly levelManager: LevelManagerLike;
  readonly persistence?: UseWallPersistenceResult;
  readonly containerClassName?: string;
  readonly hideHeader?: boolean;
  readonly projectId?: string;
  /**
   * ADR-363/412 — draft mode (draw-tool defaults, no entity). Αντί για persistence
   * εμφανίζει «Αποθήκευση ως νέος τύπος» (η σύνθεση σώζεται ως reusable τύπος).
   */
  readonly draftMode?: boolean;
}

export function WallAdvancedPanel({
  wall,
  dispatchPatch,
  userId,
  persistence,
  containerClassName,
  hideHeader,
  projectId,
  draftMode,
}: WallAdvancedPanelProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  const { libraryMaterials, libraryLoading } = useDnaMaterialOptions({ projectId });
  const resolvedClassName =
    containerClassName
    ?? 'fixed right-4 top-20 z-40 flex w-80 max-h-[calc(100vh-6rem)] flex-col gap-3 overflow-y-auto rounded-lg border border-border bg-background/95 p-3 shadow-xl backdrop-blur';

  return (
    <aside aria-label={t('wallAdvancedPanel.title')} className={resolvedClassName}>
      {!hideHeader && (
        <header>
          <h3 className="text-sm font-medium text-foreground">
            {t('wallAdvancedPanel.title')}
          </h3>
        </header>
      )}
      <WallWarningsSection wall={wall} />
      {persistence && (
        <WallPersistenceSection
          wall={wall}
          currentUserId={userId}
          persistence={persistence}
        />
      )}
      {draftMode && <WallDraftSaveTypeSection wall={wall} />}
      <WallDnaSection
        wall={wall}
        dispatchPatch={dispatchPatch}
        libraryMaterials={libraryMaterials}
        libraryLoading={libraryLoading}
      />
    </aside>
  );
}
