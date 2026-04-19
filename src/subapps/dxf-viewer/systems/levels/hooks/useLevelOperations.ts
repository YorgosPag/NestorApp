'use client';
import { useCallback } from 'react';
import { getErrorMessage } from '@/lib/error-utils';
import { useAutoSaveSceneManager } from '../../../hooks/scene/useAutoSaveSceneManager';
import { LevelOperations, FloorplanOperations } from '../utils';
import {
  createDxfLevelWithPolicy,
  updateDxfLevelWithPolicy,
  deleteDxfLevelWithPolicy,
} from '@/services/dxf-level-mutation-gateway';
import type { DxfLevelCreateResponse } from '@/app/api/dxf-levels/dxf-levels.types';
import type { Level, FloorplanDoc, LevelSystemSettings, FloorplanType } from '../config';

type SceneManager = ReturnType<typeof useAutoSaveSceneManager>;

interface UseLevelOperationsParams {
  levels: Level[];
  setLevels: React.Dispatch<React.SetStateAction<Level[]>>;
  currentLevelId: string | null;
  setCurrentLevelId: (levelId: string | null) => void;
  setFloorplans: React.Dispatch<React.SetStateAction<Record<string, FloorplanDoc>>>;
  enableFirestore: boolean;
  settings: LevelSystemSettings;
  sceneManager: SceneManager;
  setIsLoading: (loading: boolean) => void;
  handleError: (err: string | Error) => void;
  onLevelChange?: (levelId: string | null) => void;
}

export interface LevelContextUpdate {
  floorplanType?: FloorplanType;
  entityLabel?: string;
  projectId?: string;
  floorId?: string;
  buildingId?: string;
}

export interface UseLevelOperationsResult {
  addLevel: (name: string, setAsDefault?: boolean, floorId?: string) => Promise<string | null>;
  removeLevel: (levelId: string) => Promise<void>;
  deleteLevel: (levelId: string) => Promise<void>;
  clearAllLevels: () => Promise<void>;
  reorderLevels: (levelIds: string[]) => Promise<void>;
  renameLevel: (levelId: string, name: string) => Promise<void>;
  setCurrentLevel: (levelId: string) => void;
  toggleLevelVisibility: (levelId: string) => Promise<void>;
  setDefaultLevel: (levelId: string) => Promise<void>;
  duplicateLevel: (levelId: string, newName?: string) => Promise<string | null>;
  linkLevelToFloor: (levelId: string, floorId: string | null, buildingId?: string | null) => Promise<void>;
  /** ADR-309 Phase 3: Store wizard context (type + label + projectId) on a level */
  updateLevelContext: (levelId: string, context: LevelContextUpdate) => Promise<void>;
}

/**
 * 🏢 ENTERPRISE: All mutating level operations, grouped as a single hook.
 *
 * Each operation:
 *  - Handles both Firestore and in-memory modes (driven by `enableFirestore`).
 *  - Propagates failures through `handleError` (centralised error UX).
 *  - Keeps `currentLevelId` consistent when the active level is removed.
 *
 * 🔒 SSOT (ADR-286): All Firestore mutations route through the DXF level
 * mutation gateway → /api/dxf-levels → createEntity pipeline. No direct
 * client-side Firestore writes — enforces audit, tenancy, and enterprise IDs.
 *
 * The hook is pure orchestration: it owns no state of its own — all state is
 * injected via params, so the caller (LevelsSystem) remains the SSoT.
 */
export function useLevelOperations({
  levels,
  setLevels,
  currentLevelId,
  setCurrentLevelId,
  setFloorplans,
  enableFirestore,
  settings,
  sceneManager,
  setIsLoading,
  handleError,
  onLevelChange,
}: UseLevelOperationsParams): UseLevelOperationsResult {
  // 🔒 TENANT SCOPING (ADR-286): companyId + createdBy are set server-side by
  // createEntity('dxfLevel', …) — no client-side auth plumbing required.

  const addLevel = useCallback(
    async (name: string, setAsDefault = false, floorId?: string): Promise<string | null> => {
      try {
        setIsLoading(true);

        const validationError = LevelOperations.validateLevelName(name, levels);
        if (validationError) {
          handleError(validationError);
          return null;
        }

        if (enableFirestore) {
          // 🏢 ENTERPRISE (ADR-286): Route creation through centralized API
          // → /api/dxf-levels → createEntity('dxfLevel', …) → audit + enterprise ID + tenancy
          const response = await createDxfLevelWithPolicy<DxfLevelCreateResponse>({
            payload: {
              name,
              order: levels.length,
              isDefault: setAsDefault,
              visible: true,
              ...(floorId ? { floorId } : {}),
            },
          });

          const enterpriseId = response?.levelId;
          if (!enterpriseId) {
            handleError('Failed to add level to Firestore');
            return null;
          }

          if (setAsDefault || settings.autoSelectNewLevel) {
            setCurrentLevelId(enterpriseId);
            onLevelChange?.(enterpriseId);
          }
          return enterpriseId;
        } else {
          const { levels: updatedLevels, newLevelId } = LevelOperations.addLevel(
            levels,
            name,
            setAsDefault,
            floorId
          );
          setLevels(updatedLevels);

          if (setAsDefault || settings.autoSelectNewLevel) {
            setCurrentLevelId(newLevelId);
            onLevelChange?.(newLevelId);
          }
          return newLevelId;
        }
      } catch (err) {
        handleError(getErrorMessage(err, 'Failed to add level'));
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [levels, enableFirestore, settings.autoSelectNewLevel, handleError, onLevelChange, setIsLoading, setLevels, setCurrentLevelId]
  );

  const removeLevel = useCallback(
    async (levelId: string): Promise<void> => {
      try {
        setIsLoading(true);
        sceneManager.clearLevelScene(levelId);

        if (enableFirestore) {
          // 🏢 ENTERPRISE (ADR-286): Route delete through gateway → /api/dxf-levels DELETE
          await deleteDxfLevelWithPolicy({ levelId });
        } else {
          setLevels(prev => LevelOperations.removeLevel(prev, levelId));
        }

        setFloorplans(prev => FloorplanOperations.removeFloorplansForLevel(prev, levelId));

        if (currentLevelId === levelId) {
          const remainingLevels = levels.filter(l => l.id !== levelId);
          const newCurrentLevel = remainingLevels.length > 0 ? remainingLevels[0].id : null;
          setCurrentLevelId(newCurrentLevel);
          onLevelChange?.(newCurrentLevel);
        }
      } catch (err) {
        handleError(getErrorMessage(err, 'Failed to remove level'));
      } finally {
        setIsLoading(false);
      }
    },
    [levels, currentLevelId, enableFirestore, sceneManager, handleError, onLevelChange, setIsLoading, setLevels, setFloorplans, setCurrentLevelId]
  );

  const deleteLevel = useCallback(
    async (levelId: string): Promise<void> => {
      await removeLevel(levelId);
    },
    [removeLevel]
  );

  const clearAllLevels = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);

      if (enableFirestore) {
        // 🏢 ENTERPRISE (ADR-286): Parallel gateway deletes — each call audited + tenant-scoped
        await Promise.all(
          levels.map(level => deleteDxfLevelWithPolicy({ levelId: level.id }))
        );
      } else {
        setLevels([]);
      }

      sceneManager.clearAllScenes();
      setFloorplans({});
      setCurrentLevelId(null);
      onLevelChange?.(null);
    } catch (err) {
      handleError(getErrorMessage(err, 'Failed to clear levels'));
    } finally {
      setIsLoading(false);
    }
  }, [levels, enableFirestore, sceneManager, handleError, onLevelChange, setIsLoading, setLevels, setFloorplans, setCurrentLevelId]);

  const reorderLevels = useCallback(
    async (levelIds: string[]): Promise<void> => {
      try {
        if (enableFirestore) {
          // 🏢 ENTERPRISE (ADR-286): Parallel gateway updates for order
          await Promise.all(
            levelIds.map((id, index) =>
              updateDxfLevelWithPolicy({ payload: { levelId: id, order: index } })
            )
          );
        } else {
          setLevels(prev => LevelOperations.reorderLevels(prev, levelIds));
        }
      } catch (err) {
        handleError(getErrorMessage(err, 'Failed to reorder levels'));
      }
    },
    [enableFirestore, handleError, setLevels]
  );

  const renameLevel = useCallback(
    async (levelId: string, name: string): Promise<void> => {
      try {
        const validationError = LevelOperations.validateLevelName(
          name,
          levels.filter(l => l.id !== levelId)
        );
        if (validationError) {
          handleError(validationError);
          return;
        }

        if (enableFirestore) {
          // 🏢 ENTERPRISE (ADR-286): Route rename through gateway → /api/dxf-levels PATCH
          await updateDxfLevelWithPolicy({ payload: { levelId, name } });
        } else {
          setLevels(prev => LevelOperations.renameLevel(prev, levelId, name));
        }
      } catch (err) {
        handleError(getErrorMessage(err, 'Failed to rename level'));
      }
    },
    [levels, enableFirestore, handleError, setLevels]
  );

  const setCurrentLevel = useCallback(
    (levelId: string) => {
      setCurrentLevelId(levelId);
      onLevelChange?.(levelId);
    },
    [onLevelChange, setCurrentLevelId]
  );

  const toggleLevelVisibility = useCallback(
    async (levelId: string): Promise<void> => {
      try {
        const level = levels.find(l => l.id === levelId);
        if (!level) return;

        if (enableFirestore) {
          // 🏢 ENTERPRISE (ADR-286): Route visibility toggle through gateway
          await updateDxfLevelWithPolicy({
            payload: { levelId, visible: !level.visible },
          });
        } else {
          setLevels(prev => LevelOperations.toggleLevelVisibility(prev, levelId));
        }
      } catch (err) {
        handleError(getErrorMessage(err, 'Failed to toggle level visibility'));
      }
    },
    [levels, enableFirestore, handleError, setLevels]
  );

  const setDefaultLevel = useCallback(
    async (levelId: string): Promise<void> => {
      try {
        if (enableFirestore) {
          // 🏢 ENTERPRISE (ADR-286): Parallel gateway updates — flip isDefault flag per level
          await Promise.all(
            levels.map(level =>
              updateDxfLevelWithPolicy({
                payload: { levelId: level.id, isDefault: level.id === levelId },
              })
            )
          );
        } else {
          setLevels(prev => LevelOperations.setDefaultLevel(prev, levelId));
        }
      } catch (err) {
        handleError(getErrorMessage(err, 'Failed to set default level'));
      }
    },
    [levels, enableFirestore, handleError, setLevels]
  );

  const duplicateLevel = useCallback(
    async (levelId: string, newName?: string): Promise<string | null> => {
      const level = levels.find(l => l.id === levelId);
      if (!level) return null;

      const duplicateName = newName || `${level.name} (Copy)`;
      return await addLevel(duplicateName, false);
    },
    [levels, addLevel]
  );

  const linkLevelToFloor = useCallback(
    async (levelId: string, floorId: string | null, buildingId?: string | null): Promise<void> => {
      try {
        if (enableFirestore) {
          await updateDxfLevelWithPolicy({ payload: { levelId, floorId, buildingId: buildingId ?? null } });
        } else {
          setLevels(prev =>
            prev.map(l =>
              l.id === levelId
                ? { ...l, floorId: floorId ?? undefined, buildingId: buildingId ?? undefined }
                : l
            )
          );
        }
      } catch (err) {
        handleError(getErrorMessage(err, 'Failed to link level to floor'));
      }
    },
    [enableFirestore, handleError, setLevels]
  );

  const updateLevelContext = useCallback(
    async (levelId: string, context: LevelContextUpdate): Promise<void> => {
      try {
        if (enableFirestore) {
          await updateDxfLevelWithPolicy({ payload: { levelId, ...context } });
        } else {
          setLevels(prev =>
            prev.map(l => l.id === levelId ? { ...l, ...context } : l)
          );
        }
      } catch (err) {
        handleError(getErrorMessage(err, 'Failed to update level context'));
      }
    },
    [enableFirestore, handleError, setLevels]
  );

  return {
    addLevel,
    removeLevel,
    deleteLevel,
    clearAllLevels,
    reorderLevels,
    renameLevel,
    setCurrentLevel,
    toggleLevelVisibility,
    setDefaultLevel,
    duplicateLevel,
    linkLevelToFloor,
    updateLevelContext,
  };
}
