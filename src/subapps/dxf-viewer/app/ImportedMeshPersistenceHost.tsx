'use client';

/**
 * ADR-683 Φ3β — Always-on host για την persistence των εισαγόμενων πλεγμάτων.
 *
 * Καθρέφτης του `FurniturePersistenceHost` — renders `null`. Προσαρτάται στο `DxfViewerTopBar`
 * ώστε ο κύκλος ζωής του hook να τρέχει όσο ο viewer είναι ενεργός:
 *   - ακούει `drawing:entity-created` (tool: 'imported-mesh') → πρώτη αποθήκευση
 *   - debounced auto-save όταν αλλάζουν οι παράμετροι του επιλεγμένου
 *   - subscribe στο Firestore + diff-merge των εγγράφων στη σκηνή
 *   - τροφοδοτεί το 3Δ store (`setImportedMeshes`)
 *
 * Zero high-frequency subscriptions — συμβατό με CHECK 6B/6C.
 *
 * @see ./FurniturePersistenceHost — ο αδελφός που καθρεφτίζεται
 * @see docs/centralized-systems/reference/adrs/ADR-683-bim-collaboration-roundtrip.md §5
 */

import React from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import type { LevelSceneWriter } from '../systems/levels/level-scene-accessor';
import type { ImportedMeshEntity } from '../bim/entities/imported-mesh/imported-mesh-types';
import { isImportedMeshEntity } from '../types/entities';
import { useSceneEntitiesByType, useSceneEntityById } from '../systems/scene/useSceneSelectors';
import { useImportedMeshPersistence } from '../hooks/data/useImportedMeshPersistence';
import { useBim3DEntitiesStore } from '../bim-3d/stores/Bim3DEntitiesStore';

export interface ImportedMeshPersistenceHostProps {
  readonly primarySelectedId: string | null;
  readonly levelManager: LevelSceneWriter;
  readonly projectId?: string;
  readonly floorplanId?: string;
  /** ADR-420 — stable building-storey scope key (IfcBuildingStorey). */
  readonly floorId?: string;
}

function ImportedMeshPersistenceHostImpl({
  primarySelectedId,
  levelManager,
  projectId,
  floorplanId,
  floorId,
}: ImportedMeshPersistenceHostProps): React.ReactElement | null {
  const { user } = useAuth();
  const currentLevelId = levelManager.currentLevelId;

  const selectedEntity = useSceneEntityById(currentLevelId, primarySelectedId);
  const primarySelectedImportedMesh: ImportedMeshEntity | null =
    selectedEntity && isImportedMeshEntity(selectedEntity) ? selectedEntity : null;

  const importedMeshes = useSceneEntitiesByType<ImportedMeshEntity>(
    currentLevelId,
    isImportedMeshEntity,
  );
  React.useEffect(() => {
    useBim3DEntitiesStore.getState().setImportedMeshes(importedMeshes);
  }, [importedMeshes]);

  useImportedMeshPersistence({
    companyId: user?.companyId ?? null,
    projectId,
    floorplanId,
    floorId,
    userId: user?.uid ?? null,
    levelManager,
    primarySelectedImportedMesh,
  });

  return null;
}

/** ADR-547 Stage 2 — `React.memo` ώστε ο host να ΜΗΝ ξανα-render-άρει σε άσχετη επεξεργασία. */
export const ImportedMeshPersistenceHost = React.memo(ImportedMeshPersistenceHostImpl);
ImportedMeshPersistenceHost.displayName = 'ImportedMeshPersistenceHost';
