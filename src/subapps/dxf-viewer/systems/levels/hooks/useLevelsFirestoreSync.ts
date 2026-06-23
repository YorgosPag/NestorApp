'use client';
import { useEffect, useRef } from 'react';
import { orderBy, type DocumentData } from 'firebase/firestore';
import { firestoreQueryService } from '@/services/firestore';
import type { QueryResult } from '@/services/firestore';
import { getErrorMessage } from '@/lib/error-utils';
import { LevelOperations } from '../utils';
import { createDxfLevelWithPolicy } from '@/services/dxf-level-mutation-gateway';
import { hasFloorLinkedLevel, isUnlinkedDefaultLevel, pickActiveLevel } from '../level-visibility';
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

type BootstrapState = 'idle' | 'running' | 'completed' | 'failed';

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
  // ADR-040: read currentLevelId via ref inside the snapshot callback so it is
  // NOT a subscription dep. Including it in the deps array tears down + rebuilds
  // the Firestore onSnapshot on every level change, and the synchronous local-cache
  // delivery on re-attach drives a self-reinforcing idle re-render loop (~3.8Hz)
  // through CanvasSection. See ADR-040 changelog 2026-05-16.
  const currentLevelIdRef = useRef(currentLevelId);
  currentLevelIdRef.current = currentLevelId;

  // ADR-361: same-content snapshot suppression is now enforced inside
  // `firestoreQueryService.subscribe`. The previous inline hash guard was
  // removed; the service drops re-emissions whose `documents` deep-equals the
  // last delivered payload, so this hook only sees real content changes.

  // ADR-040 Phase XXI — bootstrap state guard. The previous client-side
  // `batch.commit()` on `dxf_viewer_levels` was denied by Firestore rules
  // (collection only writable via Admin SDK / API gateway, see
  // useLevelSceneLoader:151). Each rejected write triggered local-cache rollback
  // → snapshot re-emit (empty) → bootstrap re-fire → reject → idle loop ~1-2Hz.
  // The state ref ensures: (a) no concurrent bootstrap, (b) no retry after
  // failure (operator must inspect server logs), (c) no retry after success.
  const bootstrapStateRef = useRef<BootstrapState>('idle');

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
            const activeId = currentLevelIdRef.current;
            const activeLevel = activeId ? fetchedLevels.find(l => l.id === activeId) : undefined;
            // Re-elect when there is no valid active level OR the active one is the
            // unlinked bootstrap default while building structure now exists — that
            // surface silently loses data (ADR-420), so we move off it to a real
            // floor-linked level. `pickActiveLevel` is the shared SSoT used by the
            // «Στάθμες» panel filter too, so panel + active stay consistent.
            const activeIsHiddenOrphan =
              !!activeLevel && isUnlinkedDefaultLevel(activeLevel) && hasFloorLinkedLevel(fetchedLevels);
            if (!activeLevel || activeIsHiddenOrphan) {
              const nextLevel = pickActiveLevel(fetchedLevels);
              if (nextLevel && nextLevel.id !== activeId) {
                setCurrentLevelId(nextLevel.id);
                onLevelChange?.(nextLevel.id);
              }
            }
          } else if (bootstrapStateRef.current === 'idle') {
            bootstrapStateRef.current = 'running';
            const defaultLevels = LevelOperations.createDefaultLevels();
            Promise.all(
              defaultLevels.map(level =>
                createDxfLevelWithPolicy({
                  payload: {
                    name: level.name,
                    order: level.order,
                    isDefault: level.isDefault,
                    visible: level.visible,
                  },
                })
              )
            ).then(() => {
              bootstrapStateRef.current = 'completed';
            }).catch(err => {
              bootstrapStateRef.current = 'failed';
              handleError(getErrorMessage(err, 'Failed to bootstrap default levels'));
            });
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
  }, [enableFirestore, firestoreCollection, companyId, creatorUid, isSuperAdmin, onLevelChange, handleError, setLevels, setCurrentLevelId, setIsLoading, setError]);
}
