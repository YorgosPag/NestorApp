'use client';

/**
 * ADR-441 Slice 1 — Grid (guides) Firestore persistence React adapter.
 *
 * Bridges `GridGuideFirestoreService` σε `getGlobalGuideStore()` (ADR-189 SSoT).
 * Single-doc-per-floor model:
 *   - **Load**: subscribe → hydrate store (`clear` + `restoreGroup`/`restoreGuide`).
 *   - **Save**: `store.subscribe()` → debounced 1000 ms μετά settle (το debounce
 *     καλύπτει το 60fps drag — γράφει μόνο αφού σταματήσει η μετακίνηση).
 *   - **Per-floor scope**: on scope change → `store.clear()` + reset refs → νέα
 *     subscription φορτώνει τον κάναβο του νέου ορόφου (Revit per-level grid).
 *
 * Anti-echo: το signature του τελευταίου save συγκρίνεται με το incoming snapshot
 * ώστε η δική μας εγγραφή που επιστρέφει να ΜΗΝ ξανα-hydrate-άρει (loop guard).
 *
 * @see ../../systems/guides/guide-firestore-service.ts
 * @see docs/centralized-systems/reference/adrs/ADR-441-foundation-strip-grid-auto-design.md
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { getGlobalGuideStore } from '../../systems/guides/guide-store';
import {
  createGridGuideFirestoreService,
  GridGuideFirestoreService,
} from '../../systems/guides/guide-firestore-service';
import {
  guidesToSnapshots,
  snapshotToGuide,
  type GridGuideDoc,
  type GuideSnapshot,
} from '../../systems/guides/guide-persistence-types';
import type { GuideGroup } from '../../systems/guides/guide-types';

// ============================================================================
// TYPES
// ============================================================================

export type GridSaveState = 'idle' | 'saving' | 'saved' | 'error';

export interface UseGridGuidePersistenceParams {
  readonly companyId: string | null;
  readonly projectId: string | null | undefined;
  readonly floorplanId: string | null | undefined;
  /** ADR-420 — stable building-storey scope key. */
  readonly floorId: string | null | undefined;
  readonly userId: string | null;
}

export interface UseGridGuidePersistenceResult {
  readonly saveState: GridSaveState;
  readonly error: string | null;
}

// ============================================================================
// CONSTANTS + PURE HELPERS
// ============================================================================

const SAVE_DEBOUNCE_MS = 1000;

/** Stable string signature για no-op / anti-echo σύγκριση. */
function gridSignature(
  guides: readonly GuideSnapshot[],
  groups: readonly GuideGroup[],
): string {
  return JSON.stringify({ guides, groups });
}

/** Restore persisted snapshots back into the live store (groups first). */
function restoreSnapshotsToStore(
  store: ReturnType<typeof getGlobalGuideStore>,
  guides: readonly GuideSnapshot[],
  groups: readonly GuideGroup[],
): void {
  for (const group of groups) store.restoreGroup(group);
  for (const snap of guides) store.restoreGuide(snapshotToGuide(snap));
}

// ============================================================================
// HOOK
// ============================================================================

export function useGridGuidePersistence(
  params: UseGridGuidePersistenceParams,
): UseGridGuidePersistenceResult {
  const { companyId, projectId, floorplanId, floorId, userId } = params;

  const [saveState, setSaveState] = useState<GridSaveState>('idle');
  const [error, setError] = useState<string | null>(null);
  // Reactive mirror of serviceRef readiness — re-runs the subscribe effect when
  // the floor scope arrives late (e.g. fileRecordId resolves after floorId).
  const [serviceReady, setServiceReady] = useState<boolean>(false);

  const serviceRef = useRef<GridGuideFirestoreService | null>(null);
  const docIdRef = useRef<string | null>(null);
  const versionRef = useRef<number>(0);
  const suppressSaveRef = useRef<boolean>(false);
  const lastSavedSigRef = useRef<string>(gridSignature([], []));
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stable scope key — drives subscription re-keying on floor change.
  const scopeKey =
    companyId && projectId && (floorId || floorplanId) && userId
      ? `${companyId}|${projectId}|${floorId ?? floorplanId}`
      : null;

  // Instantiate service when scope ready.
  useEffect(() => {
    if (!companyId || !projectId || !floorplanId || !userId) {
      serviceRef.current = null;
      setServiceReady(false);
      return;
    }
    serviceRef.current = createGridGuideFirestoreService({
      companyId,
      projectId,
      floorplanId,
      floorId: floorId ?? undefined,
      userId,
    });
    setServiceReady(true);
  }, [companyId, projectId, floorplanId, floorId, userId]);

  // Hydrate store από Firestore doc (anti-echo guarded).
  const hydrate = useCallback((doc: GridGuideDoc) => {
    const incomingSig = gridSignature(doc.guides, doc.groups);
    if (incomingSig === lastSavedSigRef.current && docIdRef.current === doc.id) {
      return; // our own write echoed back — skip re-hydrate
    }
    const store = getGlobalGuideStore();
    suppressSaveRef.current = true;
    store.clear();
    restoreSnapshotsToStore(store, doc.guides, doc.groups);
    docIdRef.current = doc.id;
    versionRef.current = doc.version;
    lastSavedSigRef.current = incomingSig;
    suppressSaveRef.current = false;
  }, []);

  // Subscribe + per-floor reset (+ flush-on-ready for guides placed pre-scope).
  useEffect(() => {
    const svc = serviceRef.current;
    if (!svc || !scopeKey) return;

    const store = getGlobalGuideStore();

    // Guides placed before the floor scope was ready live in the store but were
    // never persisted (doSave no-op'd on the null service). Capture them before
    // the per-floor reset so we can flush them once the subscription settles.
    const pendingGuides = guidesToSnapshots(store.getGuides());
    const pendingGroups = [...store.getGroups()];
    const hasPending = pendingGuides.length > 0 || pendingGroups.length > 0;

    // Per-floor reset: ξεκίνα από καθαρό grid για τον νέο όροφο.
    suppressSaveRef.current = true;
    store.clear();
    docIdRef.current = null;
    versionRef.current = 0;
    lastSavedSigRef.current = gridSignature([], []);
    suppressSaveRef.current = false;

    let pendingSettled = false;
    const unsubscribe = svc.subscribeGrid(
      (docs) => {
        if (docs.length > 0) {
          pendingSettled = true; // remote wins — drop pre-scope pending
          hydrate(docs[0]);
          return;
        }
        // No remote doc for this floor yet: restore the pre-scope guides (once)
        // so the debounced save persists them now that the service is ready.
        if (hasPending && !pendingSettled && docIdRef.current === null) {
          pendingSettled = true;
          restoreSnapshotsToStore(store, pendingGuides, pendingGroups);
        }
      },
      (err) => {
        setError(err.message);
        setSaveState('error');
      },
    );
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey, serviceReady, hydrate]);

  // Persist current store state (debounced caller).
  const doSave = useCallback(async () => {
    const svc = serviceRef.current;
    if (!svc) return;
    const store = getGlobalGuideStore();
    const guides = guidesToSnapshots(store.getGuides());
    const groups = [...store.getGroups()];
    // Μην δημιουργείς κενό doc.
    if (!docIdRef.current && guides.length === 0 && groups.length === 0) return;
    const sig = gridSignature(guides, groups);
    if (sig === lastSavedSigRef.current) return; // no-op
    const nextVersion = versionRef.current + 1;
    setSaveState('saving');
    setError(null);
    try {
      if (docIdRef.current) {
        await svc.updateGrid(docIdRef.current, { guides, groups, version: nextVersion });
      } else {
        docIdRef.current = await svc.createGrid({ guides, groups, version: nextVersion });
      }
      versionRef.current = nextVersion;
      lastSavedSigRef.current = sig;
      setSaveState('saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'GRID_SAVE_ERROR');
      setSaveState('error');
    }
  }, []);

  // Subscribe σε store changes → debounced save (skips during hydrate/drag-live).
  useEffect(() => {
    const store = getGlobalGuideStore();
    const unsubscribe = store.subscribe(() => {
      if (suppressSaveRef.current) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => void doSave(), SAVE_DEBOUNCE_MS);
    });
    return () => {
      unsubscribe();
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [doSave]);

  return useMemo(() => ({ saveState, error }), [saveState, error]);
}
