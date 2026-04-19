'use client';
import { useEffect } from 'react';
import {
  where,
  orderBy,
  doc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../../../../../lib/firebase';
import { RealtimeService } from '@/services/realtime/RealtimeService';
import type { RealtimeCollection } from '@/services/realtime/types';
import { getErrorMessage } from '@/lib/error-utils';
import { LevelOperations } from '../utils';
import type { Level } from '../config';

interface UseLevelsFirestoreSyncParams {
  enableFirestore: boolean;
  firestoreCollection: string;
  currentLevelId: string | null;
  /** companyId from Firebase custom claims — required for tenant-scoped query */
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
  companyId,
  userId,
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
    // Wait until auth is resolved so we can build a tenant-scoped query.
    // Super-admins may query without a companyId filter (rule: isSuperAdminOnly()).
    if (!isSuperAdmin && !companyId) return;

    setIsLoading(true);

    // 🏢 ADR-195 (C.5.33): subscribe via RealtimeService SSoT — dynamic
    // collection name (param-driven) requires string-based API, not CollectionKey.
    // Non-super-admin users MUST include where('companyId', '==', ...) so that
    // Firestore can statically verify every returned document satisfies the
    // tenant-isolation rule (resource.data.companyId == getUserCompanyId()).
    // Super-admins rely on isSuperAdminOnly() in the rule, which is request-only
    // and does not require a where-clause.
    const constraints = isSuperAdmin
      ? [orderBy('order', 'asc')]
      : [where('companyId', '==', companyId), orderBy('order', 'asc')];

    // Cast dynamic param to RealtimeCollection — `firestoreCollection` is runtime
    // config (not statically a CollectionKey). Firestore rules enforce access.
    const unsubscribe = RealtimeService.subscribeToCollection(
      { collection: firestoreCollection as RealtimeCollection, constraints },
      (docs) => {
        try {
          const fetchedLevels = docs as unknown as Level[];

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
              // Include tenant-scoping fields so future reads pass security rules.
              batch.set(docRef, {
                ...levelData,
                ...(companyId ? { companyId } : {}),
                ...(userId ? { createdBy: userId } : {}),
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
      }
    );

    return () => unsubscribe();
  }, [enableFirestore, firestoreCollection, currentLevelId, companyId, userId, isSuperAdmin, onLevelChange, handleError, setLevels, setCurrentLevelId, setIsLoading, setError]);
}
