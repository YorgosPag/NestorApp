'use client';

/**
 * ADR-684 Φ2 — Always-on host για την persistence των παραμετρικών στερεών.
 *
 * Καθρέφτης του `ImportedMeshPersistenceHost` — renders `null`. Προσαρτάται στο `DxfViewerTopBar`
 * ώστε ο κύκλος ζωής του hook να τρέχει όσο ο viewer είναι ενεργός:
 *   - ακούει `drawing:entity-created` (tool: 'generic-solid') → πρώτη αποθήκευση
 *   - debounced auto-save όταν αλλάζουν οι παράμετροι του επιλεγμένου
 *   - subscribe στο Firestore + diff-merge των εγγράφων στη σκηνή
 *   - τροφοδοτεί το 3Δ store (`setGenericSolids`)
 *
 * Zero high-frequency subscriptions — συμβατό με CHECK 6B/6C.
 *
 * @see ./ImportedMeshPersistenceHost — ο αδελφός που καθρεφτίζεται
 * @see docs/centralized-systems/reference/adrs/ADR-684-generic-solid-primitive-entity.md
 */

import React from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import type { LevelSceneWriter } from '../systems/levels/level-scene-accessor';
import type { GenericSolidEntity } from '../bim/entities/generic-solid/generic-solid-types';
import { isGenericSolidEntity } from '../types/entities';
import { useSceneEntitiesByType, useSceneEntityById } from '../systems/scene/useSceneSelectors';
import { useGenericSolidPersistence } from '../hooks/data/useGenericSolidPersistence';
import { useBim3DEntitiesStore } from '../bim-3d/stores/Bim3DEntitiesStore';

export interface GenericSolidPersistenceHostProps {
  readonly primarySelectedId: string | null;
  readonly levelManager: LevelSceneWriter;
  readonly projectId?: string;
  readonly floorplanId?: string;
  /** ADR-420 — stable building-storey scope key (IfcBuildingStorey). */
  readonly floorId?: string;
}

function GenericSolidPersistenceHostImpl({
  primarySelectedId,
  levelManager,
  projectId,
  floorplanId,
  floorId,
}: GenericSolidPersistenceHostProps): React.ReactElement | null {
  const { user } = useAuth();
  const currentLevelId = levelManager.currentLevelId;

  const selectedEntity = useSceneEntityById(currentLevelId, primarySelectedId);
  const primarySelectedGenericSolid: GenericSolidEntity | null =
    selectedEntity && isGenericSolidEntity(selectedEntity) ? selectedEntity : null;

  const genericSolids = useSceneEntitiesByType<GenericSolidEntity>(
    currentLevelId,
    isGenericSolidEntity,
  );
  React.useEffect(() => {
    useBim3DEntitiesStore.getState().setGenericSolids(genericSolids);
  }, [genericSolids]);

  useGenericSolidPersistence({
    companyId: user?.companyId ?? null,
    projectId,
    floorplanId,
    floorId,
    userId: user?.uid ?? null,
    levelManager,
    primarySelectedGenericSolid,
  });

  return null;
}

/** ADR-547 Stage 2 — `React.memo` ώστε ο host να ΜΗΝ ξανα-render-άρει σε άσχετη επεξεργασία. */
export const GenericSolidPersistenceHost = React.memo(GenericSolidPersistenceHostImpl);
GenericSolidPersistenceHost.displayName = 'GenericSolidPersistenceHost';
