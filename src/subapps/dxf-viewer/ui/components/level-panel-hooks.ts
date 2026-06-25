'use client';

/**
 * LevelPanel hooks — extracted to keep `LevelPanel.tsx` under the 500-line
 * Google file-size limit (N.7.1). Pure state/effect logic, zero JSX.
 *
 * @module ui/components/level-panel-hooks
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import type { EntityType } from '@/config/domain-constants';
import type { Level, FloorplanType } from '../../systems/levels/config';
import type { LevelFloorResolver } from '../../systems/levels/level-floor-resolution';
import { findOrCreateLevelForFloor } from '../../systems/levels/level-floor-resolution';
import { ensureLevelsForBuilding } from '../../systems/levels/ensure-levels-for-building';
import { useFloorsByBuilding } from '@/components/properties/shared/useFloorsByBuilding';
import { FileRecordService } from '@/services/file-record.service';
import type { DxfSaveContext } from '../../services/dxf-firestore.service';
import type { WizardCompleteMeta } from '@/features/floorplan-import';

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

/** Scene-import callback shape (matches `LevelPanelProps.onSceneImported`). */
export type OnSceneImported = (
  file: File,
  encoding?: string,
  saveContext?: DxfSaveContext,
  targetLevelId?: string,
) => void;

/** Subset of `useLevels` context writers needed by the import-complete flow. */
export interface FloorplanImportCompleteDeps {
  readonly resolver: LevelFloorResolver;
  readonly currentLevelId: string | null;
  readonly setCurrentLevel: (levelId: string) => void;
  readonly updateLevelContext: (
    levelId: string,
    context: { floorplanType?: FloorplanType; entityLabel?: string; projectId?: string; floorId?: string; buildingId?: string },
  ) => Promise<void> | void;
  readonly entityTypeToFloorplanType: (entityType: EntityType) => FloorplanType | undefined;
  readonly triggerAllFloorsBackfill: TriggerAllFloorsBackfill;
  readonly onSceneImported?: OnSceneImported;
}

/**
 * ADR-420/465 — SSoT import-complete handler. Returns the SAME callback the
 * Floorplan Import Wizard fires AND the cross-floor duplicate dialog reuses, so
 * scene rendering + level wiring live in ONE place (no copy-paste, N.0.2). The
 * duplicate dialog hands the SAME `WizardCompleteMeta` shape after re-feeding the
 * source DXF through `uploadSmart`.
 */
export function useFloorplanImportComplete(deps: FloorplanImportCompleteDeps) {
  const {
    resolver, currentLevelId, setCurrentLevel, updateLevelContext,
    entityTypeToFloorplanType, triggerAllFloorsBackfill, onSceneImported,
  } = deps;
  const { levels, addLevel, linkLevelToFloor } = resolver;

  return useCallback(
    async (file: File, meta: WizardCompleteMeta) => {
      if (!onSceneImported) return;
      const entityType = meta.entityType as DxfSaveContext['entityType'];
      const saveContext: DxfSaveContext = {
        companyId: meta.companyId,
        projectId: meta.projectId,
        ...(entityType === 'building' && meta.entityId ? { buildingId: meta.entityId } : {}),
        ...(entityType === 'floor' && meta.entityId ? { floorId: meta.entityId } : {}),
        entityType,
        filesCategory: 'floorplans',
        purpose: meta.purpose || undefined,
        entityLabel: meta.entityLabel,
        fileRecordId: meta.fileId,
      };
      // ADR-420 — resolve the Level that OWNS the selected floor (find-or-create
      // + switch), so the import targets that floor's own level rather than the
      // active level. Falls back to the active level for project/building imports.
      const targetLevelId = await findOrCreateLevelForFloor(
        { levels, addLevel, linkLevelToFloor },
        {
          floorId: saveContext.floorId,
          buildingId: meta.buildingId ?? saveContext.buildingId,
          entityLabel: meta.entityLabel,
          currentLevelId,
        },
      );
      if (targetLevelId) {
        setCurrentLevel(targetLevelId);
        const floorplanType = entityTypeToFloorplanType(meta.entityType);
        if (floorplanType) {
          void updateLevelContext(targetLevelId, {
            floorplanType,
            entityLabel: meta.entityLabel,
            projectId: meta.projectId,
            floorId: saveContext.floorId,
            // ADR-399: building comes from the selection (saveContext only carries
            // buildingId for 'building' imports, not for 'floor').
            buildingId: meta.buildingId ?? saveContext.buildingId,
          });
        }
      }
      // ADR-448 Phase 3 — open a Level for every storey of the building when
      // requested (idempotent backfill).
      const allFloorsBuilding = meta.buildingId ?? saveContext.buildingId;
      if (meta.loadAllFloors && allFloorsBuilding) {
        triggerAllFloorsBackfill(allFloorsBuilding);
      }
      // Raster (PDF / image) is already persisted via /api/floorplan-backgrounds.
      // The DXF scene importer must NOT run for raster. ADR-526 Φ4: `'tek'` DOES
      // need the scene importer — `handleFileImport` branches on `isTekFileName`
      // → `importTekFile` — so let it through alongside `'dxf'`.
      if (meta.format && meta.format !== 'dxf' && meta.format !== 'tek') return;
      onSceneImported(file, undefined, saveContext, targetLevelId ?? undefined);
    },
    [
      onSceneImported, levels, addLevel, linkLevelToFloor, currentLevelId,
      setCurrentLevel, entityTypeToFloorplanType, updateLevelContext,
      triggerAllFloorsBackfill,
    ],
  );
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
