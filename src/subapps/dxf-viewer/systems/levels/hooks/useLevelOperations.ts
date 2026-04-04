'use client';
import { useCallback } from 'react';
import {
  setDoc,
  deleteDoc,
  doc,
  writeBatch,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../../../../../lib/firebase';
import { getErrorMessage } from '@/lib/error-utils';
import { withStorageErrorHandling } from '../../../utils/storage-utils';
import { useAutoSaveSceneManager } from '../../../hooks/scene/useAutoSaveSceneManager';
import { LevelOperations, FloorplanOperations } from '../utils';
import type { Level, FloorplanDoc, LevelSystemSettings } from '../config';

type SceneManager = ReturnType<typeof useAutoSaveSceneManager>;

interface UseLevelOperationsParams {
  levels: Level[];
  setLevels: React.Dispatch<React.SetStateAction<Level[]>>;
  currentLevelId: string | null;
  setCurrentLevelId: (levelId: string | null) => void;
  setFloorplans: React.Dispatch<React.SetStateAction<Record<string, FloorplanDoc>>>;
  enableFirestore: boolean;
  firestoreCollection: string;
  settings: LevelSystemSettings;
  sceneManager: SceneManager;
  setIsLoading: (loading: boolean) => void;
  handleError: (err: string | Error) => void;
  onLevelChange?: (levelId: string | null) => void;
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
}

/**
 * 🏢 ENTERPRISE: All mutating level operations, grouped as a single hook.
 *
 * Each operation:
 *  - Handles both Firestore and in-memory modes (driven by `enableFirestore`).
 *  - Propagates failures through `handleError` (centralised error UX).
 *  - Keeps `currentLevelId` consistent when the active level is removed.
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
  firestoreCollection,
  settings,
  sceneManager,
  setIsLoading,
  handleError,
  onLevelChange,
}: UseLevelOperationsParams): UseLevelOperationsResult {
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
          const newLevelData = {
            name,
            order: levels.length,
            isDefault: setAsDefault,
            visible: true,
            createdAt: serverTimestamp(),
            ...(floorId ? { floorId } : {}),
          };

          const { generateLevelId } = await import('@/services/enterprise-id.service');
          const enterpriseId = generateLevelId();
          const docRef = doc(db, firestoreCollection, enterpriseId);
          await withStorageErrorHandling(
            () => setDoc(docRef, newLevelData),
            'Failed to add level to Firestore'
          );

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
    [levels, enableFirestore, firestoreCollection, settings.autoSelectNewLevel, handleError, onLevelChange, setIsLoading, setLevels, setCurrentLevelId]
  );

  const removeLevel = useCallback(
    async (levelId: string): Promise<void> => {
      try {
        setIsLoading(true);
        sceneManager.clearLevelScene(levelId);

        if (enableFirestore) {
          await deleteDoc(doc(db, firestoreCollection, levelId));
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
    [levels, currentLevelId, enableFirestore, firestoreCollection, sceneManager, handleError, onLevelChange, setIsLoading, setLevels, setFloorplans, setCurrentLevelId]
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
        const batch = writeBatch(db);
        levels.forEach(level => {
          batch.delete(doc(db, firestoreCollection, level.id));
        });
        await batch.commit();
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
  }, [levels, enableFirestore, firestoreCollection, sceneManager, handleError, onLevelChange, setIsLoading, setLevels, setFloorplans, setCurrentLevelId]);

  const reorderLevels = useCallback(
    async (levelIds: string[]): Promise<void> => {
      try {
        if (enableFirestore) {
          const batch = writeBatch(db);
          levelIds.forEach((id, index) => {
            batch.update(doc(db, firestoreCollection, id), { order: index });
          });
          await batch.commit();
        } else {
          setLevels(prev => LevelOperations.reorderLevels(prev, levelIds));
        }
      } catch (err) {
        handleError(getErrorMessage(err, 'Failed to reorder levels'));
      }
    },
    [enableFirestore, firestoreCollection, handleError, setLevels]
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
          await updateDoc(doc(db, firestoreCollection, levelId), { name });
        } else {
          setLevels(prev => LevelOperations.renameLevel(prev, levelId, name));
        }
      } catch (err) {
        handleError(getErrorMessage(err, 'Failed to rename level'));
      }
    },
    [levels, enableFirestore, firestoreCollection, handleError, setLevels]
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
          await updateDoc(doc(db, firestoreCollection, levelId), { visible: !level.visible });
        } else {
          setLevels(prev => LevelOperations.toggleLevelVisibility(prev, levelId));
        }
      } catch (err) {
        handleError(getErrorMessage(err, 'Failed to toggle level visibility'));
      }
    },
    [levels, enableFirestore, firestoreCollection, handleError, setLevels]
  );

  const setDefaultLevel = useCallback(
    async (levelId: string): Promise<void> => {
      try {
        if (enableFirestore) {
          const batch = writeBatch(db);
          levels.forEach(level => {
            batch.update(doc(db, firestoreCollection, level.id), {
              isDefault: level.id === levelId,
            });
          });
          await batch.commit();
        } else {
          setLevels(prev => LevelOperations.setDefaultLevel(prev, levelId));
        }
      } catch (err) {
        handleError(getErrorMessage(err, 'Failed to set default level'));
      }
    },
    [levels, enableFirestore, firestoreCollection, handleError, setLevels]
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
  };
}
