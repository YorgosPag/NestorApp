'use client';

/**
 * ENTERPRISE BUILDINGS HOOK — Real-time via firestoreQueryService.subscribe (ADR-227, ADR-355 SSoT, ADR-361 equality-guarded)
 *
 * Replaces the previous REST + useAsyncData pattern that caused full-screen
 * flicker on every CRUD event (setLoading(true) → spinner → data).
 *
 * Uses firestoreQueryService.subscribe('BUILDINGS', ...) — the canonical
 * real-time path with tenant isolation (auto-companyId injection), auth-ready
 * gating, and content-equality guard (ADR-361). Updates arrive incrementally —
 * no loading state on mutations.
 *
 * 🚀 PERF (2026-06-11, ADR-300 follow-up): the Firestore listener is now a
 * SINGLE module-level, reference-counted subscription shared by every call site
 * (useSyncExternalStore). Before, each of the ~11 simultaneous callers
 * (NavigationContext, BuildingsPageContent, ThermalEnvelopeHost,
 * useBimScheduleLookups, useSiteNeighbourMasses, useHeatLoadInputs,
 * useBuildingFloors3DSync, useExecutiveReport, IfcExportHost, PO selectors…)
 * opened its OWN onSnapshot → 9× "Buildings updated" + 9× map/sort per change.
 * Now: first mount opens the listener, last unmount closes it; all consumers
 * read the same store. The ADR-300 stale cache still seeds zero-flash remounts.
 *
 * @ssot ADR-227 — Real-Time Subscription Consolidation
 * @ssot ADR-228 — Real-Time Event Bus Coverage
 */

import { useCallback, useSyncExternalStore } from 'react';
import { firestoreQueryService } from '@/services/firestore';
import type { QueryResult } from '@/services/firestore';
import type { DocumentData } from 'firebase/firestore';
import type { Building } from '@/types/building/contracts';
import { createModuleLogger } from '@/lib/telemetry';
// 🏢 ADR-300: Stale-while-revalidate — prevents navigation flash on remount
import { createStaleCache } from '@/lib/stale-cache';
// SSoT pub/sub primitive (WAVE 3) — replaces the hand-rolled listener Set + emit()
import { createExternalStore } from '@/lib/state/createExternalStore';

const logger = createModuleLogger('useFirestoreBuildings');

// ADR-300: Module-level cache survives React unmount/remount (navigation)
const buildingsCache = createStaleCache<Building[]>('buildings');

interface UseFirestoreBuildingsReturn {
  buildings: Building[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Normalize a createdAt value to milliseconds.
 * Handles Firestore Timestamp objects, ISO strings, and numeric millis.
 */
function toMillis(value: unknown): number {
  if (!value) return 0;
  if (typeof value === 'object' && value !== null && 'toMillis' in value) {
    return (value as { toMillis(): number }).toMillis();
  }
  if (typeof value === 'string') return new Date(value).getTime() || 0;
  if (typeof value === 'number') return value;
  return 0;
}

// ──────────────────────────────────────────────────────────────────────────
// Shared module-level store (SSoT listener — one onSnapshot for ALL consumers)
// ──────────────────────────────────────────────────────────────────────────

interface BuildingsStoreState {
  buildings: Building[];
  loading: boolean;
  error: string | null;
}

/** Snapshot reference is replaced wholesale on each change so useSyncExternalStore
 *  can compare by identity (stable between emits → no spurious re-render). The
 *  content-equality guard lives upstream in firestoreQueryService.subscribe (ADR-361),
 *  so this store always notifies on set (no `equals`). */
const buildingsStore = createExternalStore<BuildingsStoreState>({
  buildings: buildingsCache.get() ?? [],
  loading: !buildingsCache.hasLoaded(),
  error: null,
});

let firestoreUnsubscribe: (() => void) | null = null;
let refCount = 0;

function setStoreState(patch: Partial<BuildingsStoreState>): void {
  buildingsStore.set({ ...buildingsStore.get(), ...patch });
}

function startFirestoreSubscription(): void {
  if (firestoreUnsubscribe) return; // already active — idempotent
  // ADR-300: only show spinner on first ever load, not on re-navigation
  if (!buildingsCache.hasLoaded()) setStoreState({ loading: true });

  firestoreUnsubscribe = firestoreQueryService.subscribe<DocumentData>(
    'BUILDINGS',
    (result: QueryResult<DocumentData>) => {
      const mapped = result.documents
        // Mirror server-side soft-delete exclusion (ADR-281)
        .filter(doc => doc.status !== 'deleted')
        // Mirror server-side sort: createdAt desc
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
        .map(doc => doc as unknown as Building);

      logger.debug('Buildings updated via real-time subscription', { count: mapped.length });
      // ADR-300: Write to module-level cache so next remount skips spinner
      buildingsCache.set(mapped);
      setStoreState({ buildings: mapped, loading: false, error: null });
    },
    (err: Error) => {
      logger.error('Firestore subscription error', { error: err.message });
      setStoreState({ error: err.message, loading: false });
    }
  );
}

/** useSyncExternalStore subscribe — attaches a React listener AND owns one slot
 *  of the shared Firestore listener's reference count. */
function subscribe(listener: () => void): () => void {
  const unsubscribe = buildingsStore.subscribe(listener);
  refCount += 1;
  if (refCount === 1) startFirestoreSubscription();

  return () => {
    unsubscribe();
    refCount -= 1;
    if (refCount === 0 && firestoreUnsubscribe) {
      firestoreUnsubscribe();
      firestoreUnsubscribe = null;
    }
  };
}

function getSnapshot(): BuildingsStoreState {
  return buildingsStore.get();
}

export function useFirestoreBuildings(): UseFirestoreBuildingsReturn {
  // Single shared subscription — getSnapshot returns a stable reference between
  // emits, so React only re-renders this consumer when the store actually changes.
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  // No-op: onSnapshot handles all updates automatically.
  // Kept for API compatibility with callers that invoke refetch() after mutations.
  const refetch = useCallback((): Promise<void> => Promise.resolve(), []);

  return { buildings: state.buildings, loading: state.loading, error: state.error, refetch };
}
