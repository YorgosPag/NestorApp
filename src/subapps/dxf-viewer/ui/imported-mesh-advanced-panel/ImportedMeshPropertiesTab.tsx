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
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useLevels } from '../../systems/levels';
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
}: ImportedMeshPropertiesTabProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  const mesh = useSelectedImportedMesh(primarySelectedId, currentScene);
  const levelManager = useLevels();
  const dispatchPatch = useImportedMeshParamsDispatcher({ levelManager });

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
    />
  );
}
