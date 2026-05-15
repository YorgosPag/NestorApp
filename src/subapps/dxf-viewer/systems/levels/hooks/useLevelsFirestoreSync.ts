'use client';
import { useEffect } from 'react';
import { orderBy, doc, writeBatch, type DocumentData } from 'firebase/firestore';
import { db } from '../../../../../lib/firebase';
import { firestoreQueryService } from '@/services/firestore';
import type { QueryResult } from '@/services/firestore';
import { getErrorMessage } from '@/lib/error-utils';
import { LevelOperations } from '../utils';
import type { Level } from '../config';

interface UseLevelsFirestoreSyncParams {
  enableFirestore: boolean;
  firestoreCollection: string;
  currentLevelId: string | null;
  /** companyId from Firebase custom claims — required for tenant-scoped bootstrap write */
  companyId: string | null | undefined;
  /** uid of the authenticated user — used for bootstrap doc ownership */
  userId: string | null | undefined;
  /** true when user has globalRole == 'super_admin' in their JWT */
  isSuperAdmin: boolean;
  setLevels: (levels: Level[]) => void;
  setCurrentLevelId: (levelId: string | null) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  onLevelChange?: (levelId: string | null) => void;
  handleError: (err: string | Error) => void;
}

/**
 * Real-time Firestore sync for the levels collection (ADR-355 SSOT).
 *
 * Subscribes via `firestoreQueryService.subscribe('DXF_VIEWER_LEVELS', ...)`:
 *  - Tenant filter (where companyId == effectiveCompanyId) auto-applied
 *  - Super-admin switcher re-subscription auto-handled (ADR-354 entry point #3)
 *  - Auth-readiness gating auto-handled
 * Hook owns: orderBy('order'), bootstrap-on-empty, level re-election.
 */
export function useLevelsFirestoreSync({
  enableFirestore,
  firestoreCollection,
  currentLevelId,
  companyId,
  userId: creatorUid,
  isSuperAdmin,
  setLevels,
  setCurrentLevelId,
  setIsLoading,
  setError,
  onLevelChange,
  handleError,
}: UseLevelsFirestoreSyncParams): void {
  useEffect(() => {
    if (!enableFirestore) return;
    if (!isSuperAdmin && !companyId) return;

    setIsLoading(true);

    const unsubscribe = firestoreQueryService.subscribe<DocumentData>(
      'DXF_VIEWER_LEVELS',
      (result: QueryResult<DocumentData>) => {
        try {
          const fetchedLevels = result.documents as unknown as Level[];

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
              batch.set(docRef, {
                ...levelData,
                ...(companyId ? { companyId } : {}),
                ...(creatorUid ? { createdBy: creatorUid } : {}),
              });
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
      },
      { constraints: [orderBy('order', 'asc')] }
    );

    return () => unsubscribe();
  }, [enableFirestore, firestoreCollection, currentLevelId, companyId, creatorUid, isSuperAdmin, onLevelChange, handleError, setLevels, setCurrentLevelId, setIsLoading, setError]);
}
