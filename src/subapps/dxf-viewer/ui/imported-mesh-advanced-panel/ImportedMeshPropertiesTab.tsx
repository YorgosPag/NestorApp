'use client';

/**
 * ADR-683 Φ3.1γ (B1) — wraps `ImportedMeshAdvancedPanel` sections inside the
 * left-sidebar floating-panel container as the "Properties" tab. Mirrors
 * `RailingPropertiesTab` (ADR-407 Φ9) / `StairPropertiesTab` (ADR-358 Phase 8).
 *
 * Render contract:
 *   - imported mesh selected → mount `ImportedMeshAdvancedPanel` with all sections
 *   - no imported mesh selected → small empty-state hint
 *
 * No persistence wiring (unlike stair) — the imported-mesh entity does not have
 * a `BimPersistenceStateStore` slot; this stays presentational + side-effect-free
 * for the inner panel, same as the other per-type tabs.
 *
 * ADR-683 Φ3.1γ follow-up — this tab is now where the panel's two external
 * dependencies get resolved (pure derivation, no new mutation lifecycle, N.7.2 §7):
 *   - `levelName` — `params.storeyId` (assigned level) else the active `currentLevelId`,
 *     resolved against the live `levels` array (same `.find(l => l.id === …)` idiom as
 *     `overlay-store.tsx` / `useFloorplanBackgroundForLevel`).
 *   - `libraryEntries` — the ADR-687 Φ8 general material library (catalog + Firestore user
 *     materials + paints), built the SAME way `MaterialsLibraryPanel` does
 *     (`useMaterialLibrary` + `buildMaterialLibraryEntries`), so «Υλικό» can show the live
 *     override's real label instead of a bare id.
 */

import React, { useMemo } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useAuth } from '@/auth/hooks/useAuth';
import { useCompanyId } from '@/hooks/useCompanyId';
import { useLevels } from '../../systems/levels';
import { useMaterialLibrary } from '../panels/materials/hooks/useMaterialLibrary';
import { buildMaterialLibraryEntries } from '../../bim-3d/ui/material-library-index';
import { useSelectedImportedMesh } from './hooks/useSelectedImportedMesh';
import { useImportedMeshParamsDispatcher } from './commands/dispatchImportedMeshParamPatch';
import { ImportedMeshAdvancedPanel } from './ImportedMeshAdvancedPanel';
import type { SceneModel } from '../../types/scene';

export interface ImportedMeshPropertiesTabProps {
  readonly primarySelectedId: string | null;
  readonly currentScene: SceneModel | null;
  readonly projectId?: string;
  readonly floorplanId?: string;
}

export function ImportedMeshPropertiesTab({
  primarySelectedId,
  currentScene,
  projectId,
}: ImportedMeshPropertiesTabProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  const mesh = useSelectedImportedMesh(primarySelectedId, currentScene);
  const levelManager = useLevels();
  const dispatchPatch = useImportedMeshParamsDispatcher({ levelManager });

  // ADR-683 Φ3.1γ follow-up (level readout) — prefer the mesh's OWN assigned storey over the
  // orchestrator's active level, so the identity panel keeps showing the right floor even while
  // the user is looking at a different level (Revit "Level" instance-parameter parity).
  const levelId = mesh?.params.storeyId ?? levelManager.currentLevelId;
  const levelName = levelId
    ? (levelManager.levels.find((l) => l.id === levelId)?.name ?? null)
    : null;

  // ADR-687 Φ8 — same recipe as `MaterialsLibraryPanel` (companyId + userId gate the Firestore
  // subscription; catalog/paint entries still resolve without auth).
  const { user } = useAuth();
  const companyResult = useCompanyId();
  const { materials } = useMaterialLibrary({
    companyId: companyResult?.companyId,
    userId: user?.uid,
    projectId,
  });
  const libraryEntries = useMemo(() => buildMaterialLibraryEntries(materials, t), [materials, t]);

  if (!mesh) {
    return (
      <p className="px-3 py-6 text-center text-xs text-muted-foreground">
        {t('importedMeshAdvancedPanel.emptyState')}
      </p>
    );
  }

  return (
    <ImportedMeshAdvancedPanel
      mesh={mesh}
      dispatchPatch={dispatchPatch}
      containerClassName="flex flex-col gap-3 p-2"
      levelName={levelName}
      libraryEntries={libraryEntries}
    />
  );
}
