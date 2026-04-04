'use client';
import { useEffect } from 'react';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../../../../../lib/firebase';
import { getErrorMessage } from '@/lib/error-utils';
import { LevelOperations } from '../utils';
import type { Level } from '../config';

interface UseLevelsFirestoreSyncParams {
  enableFirestore: boolean;
  firestoreCollection: string;
  currentLevelId: string | null;
  setLevels: (levels: Level[]) => void;
  setCurrentLevelId: (levelId: string | null) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  onLevelChange?: (levelId: string | null) => void;
  handleError: (err: string | Error) => void;
}

/**
 * 🏢 ENTERPRISE: Real-time Firestore sync for the levels collection
 *
 * Subscribes to the levels collection (ordered by `order`) and:
 *  - Keeps the local `levels` state in sync with Firestore (onSnapshot).
 *  - Selects a sensible default level when none is selected or the current
 *    selection disappears (prefers the `isDefault` level, else the first).
 *  - Bootstraps the collection with default levels on first run (empty collection).
 *  - Surfaces transport errors via `handleError`.
 */
export function useLevelsFirestoreSync({
  enableFirestore,
  firestoreCollection,
  currentLevelId,
  setLevels,
  setCurrentLevelId,
  setIsLoading,
  setError,
  onLevelChange,
  handleError,
}: UseLevelsFirestoreSyncParams): void {
  useEffect(() => {
    if (!enableFirestore) return;

    setIsLoading(true);
    const q = query(collection(db, firestoreCollection), orderBy('order', 'asc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        try {
          const fetchedLevels = snapshot.docs.map(
            doc => ({ ...doc.data(), id: doc.id } as Level)
          );

          if (fetchedLevels.length > 0) {
            setLevels(fetchedLevels);
            if (!currentLevelId || !fetchedLevels.some(l => l.id === currentLevelId)) {
              const defaultLevel = fetchedLevels.find(l => l.isDefault) || fetchedLevels[0];
              setCurrentLevelId(defaultLevel.id);
              onLevelChange?.(defaultLevel.id);
            }
          } else {
            const defaultLevels = LevelOperations.createDefaultLevels();
            const batch = writeBatch(db);
            defaultLevels.forEach(level => {
              const { id, ...levelData } = level;
              const docRef = doc(db, firestoreCollection, id);
              batch.set(docRef, levelData);
            });
            batch.commit().then(() => console.log('Default levels created in Firestore.'));
          }
          setIsLoading(false);
          setError(null);
        } catch (err) {
          handleError(getErrorMessage(err, 'Failed to load levels'));
          setIsLoading(false);
        }
      },
      (err) => {
        handleError(`Firestore error: ${err.message}`);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [enableFirestore, firestoreCollection, currentLevelId, onLevelChange, handleError, setLevels, setCurrentLevelId, setIsLoading, setError]);
}
