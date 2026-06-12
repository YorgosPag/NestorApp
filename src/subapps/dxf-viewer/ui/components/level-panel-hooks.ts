'use client';

/**
 * LevelPanel hooks — extracted to keep `LevelPanel.tsx` under the 500-line
 * Google file-size limit (N.7.1). Pure state/effect logic, zero JSX.
 *
 * @module ui/components/level-panel-hooks
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import type { Level } from '../../systems/levels/config';
import type { LevelFloorResolver } from '../../systems/levels/level-floor-resolution';
import { ensureLevelsForBuilding } from '../../systems/levels/ensure-levels-for-building';
import { useFloorsByBuilding } from '@/components/properties/shared/useFloorsByBuilding';
import { FileRecordService } from '@/services/file-record.service';

/** Fire-and-forget trigger: pass the building id to backfill all its storeys. */
export type TriggerAllFloorsBackfill = (buildingId: string) => void;

/**
 * ADR-448 Phase 3 — «Φόρτωσε ΟΛΟΥΣ τους ορόφους».
 *
 * Decouples the all-floors Level backfill from the wizard's synchronous
 * selected-floor switch. The caller fires the returned trigger from the wizard
 * `onComplete`; the hook then loads the building's full storey list off the
 * shared FLOORS subscription and opens one Level per floor via the idempotent
 * `ensureLevelsForBuilding` loop. Decoupling avoids racing the active-level
 * switch (the selected floor is already linked → skipped).
 *
 * @see systems/levels/ensure-levels-for-building.ts
 */
export function useAllFloorsBackfill(resolver: LevelFloorResolver): TriggerAllFloorsBackfill {
  const { levels, addLevel, linkLevelToFloor } = resolver;
  const [allFloorsBuildingId, setAllFloorsBuildingId] = useState<string | null>(null);
  const { floors: buildingFloors, loading: buildingFloorsLoading } = useFloorsByBuilding(allFloorsBuildingId);
  const allFloorsRunningRef = useRef(false);

  useEffect(() => {
    if (!allFloorsBuildingId || buildingFloorsLoading || buildingFloors.length === 0) return;
    if (allFloorsRunningRef.current) return;
    allFloorsRunningRef.current = true;
    const targetBuildingId = allFloorsBuildingId;
    void (async () => {
      try {
        await ensureLevelsForBuilding(
          { levels, addLevel, linkLevelToFloor },
          buildingFloors.map((f) => ({ id: f.id, number: f.number, label: f.longName ?? f.name })),
          targetBuildingId,
        );
      } finally {
        allFloorsRunningRef.current = false;
        setAllFloorsBuildingId(null);
      }
    })();
  }, [allFloorsBuildingId, buildingFloors, buildingFloorsLoading, levels, addLevel, linkLevelToFloor]);

  return useCallback((buildingId: string) => setAllFloorsBuildingId(buildingId), []);
}

export interface LevelDeletionDeps {
  readonly levels: Level[];
  readonly deleteLevel: (levelId: string) => Promise<void>;
  readonly userUid: string | undefined;
}

export interface LevelDeletionApi {
  readonly showDeleteConfirm: boolean;
  readonly setShowDeleteConfirm: (open: boolean) => void;
  readonly requestDeleteLevel: (levelId: string) => void;
  readonly handleConfirmDelete: () => Promise<void>;
  readonly handleCloseLevel: (levelId: string) => Promise<void>;
}

/**
 * Level delete/close lifecycle. `requestDeleteLevel` opens the confirm dialog;
 * `handleConfirmDelete` removes the level and best-effort trashes its linked
 * FileRecord; `handleCloseLevel` removes a level without the confirm prompt.
 */
export function useLevelDeletion({ levels, deleteLevel, userUid }: LevelDeletionDeps): LevelDeletionApi {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const pendingDeleteLevelRef = useRef<string | null>(null);

  const requestDeleteLevel = useCallback((levelId: string) => {
    pendingDeleteLevelRef.current = levelId;
    setShowDeleteConfirm(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    const levelId = pendingDeleteLevelRef.current;
    if (!levelId) return;
    try {
      const level = levels.find(l => l.id === levelId);
      await deleteLevel(levelId);
      // Trash underlying FileRecord if linked
      if (level?.sceneFileId && userUid) {
        try {
          await FileRecordService.moveToTrash(level.sceneFileId, userUid);
        } catch {
          // Non-blocking — level removed, file trash best-effort
        }
      }
    } catch (error) {
      console.error('Failed to delete level:', error);
    } finally {
      setShowDeleteConfirm(false);
      pendingDeleteLevelRef.current = null;
    }
  }, [levels, deleteLevel, userUid]);

  const handleCloseLevel = useCallback(async (levelId: string) => {
    try {
      await deleteLevel(levelId);
    } catch (error) {
      console.error('Failed to close level:', error);
    }
  }, [deleteLevel]);

  return { showDeleteConfirm, setShowDeleteConfirm, requestDeleteLevel, handleConfirmDelete, handleCloseLevel };
}
