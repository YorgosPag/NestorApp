'use client';

/**
 * useFloorsByBuilding — Real-time floor subscription scoped to a building.
 *
 * Returns the sorted floor list (basement → ground → upper) for the given
 * building. Used by ADR-329 BOQ scope pickers (FloorSelectByBuilding), the DXF
 * floor tabs / 3D multi-floor stack (ADR-399), the MEP riser bridge/overlay
 * (ADR-408 Φ15) and any consumer needing floor-scoped data.
 *
 * 🏢 SSoT SHARED SUBSCRIPTION (ADR-329 / ADR-399): every `FLOORS` consumer reads
 * through ONE reference-counted `onSnapshot` listener per (user, building). The
 * previous design opened an independent listener per hook instance — 6+ identical
 * `FLOORS` targets ran in parallel, which tripped the firebase-js-sdk watch-stream
 * target-state assertion (`INTERNAL ASSERTION FAILED b815 / ve:-1`). One source of
 * truth → one listener → no duplicate targets. The public API is unchanged.
 *
 * @module components/properties/shared/useFloorsByBuilding
 * @see ADR-329 §3.4 (Floor Select)
 */

import { useEffect, useState } from 'react';
import { where } from 'firebase/firestore';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import { useAuth } from '@/auth/contexts/AuthContext';
import { createModuleLogger } from '@/lib/telemetry';
import { isFloorKind, type FloorKind } from '@/utils/floor-naming';

const logger = createModuleLogger('useFloorsByBuilding');

export interface FloorOption {
  id: string;
  number: number;
  name: string;
  buildingId: string;
  /** ADR-399: Greek canonical label (ADR-369) — used by the floor-tab strip. */
  longName?: string;
  /** ADR-399: Revit-style classification (ADR-369) — drives label fallback. */
  kind?: FloorKind;
  /**
   * ADR-369 storey elevation in **metres** (world Y), as entered in the building
   * «Όροφοι» tab (default = number × 3.0m). Canonical source for 3D multi-floor
   * stacking (ADR-399 Phase B) — read straight from the FLOORS doc here so the
   * stack height matches the tab, bypassing the lossy ProjectHierarchyContext.
   */
  elevation?: number;
}

export interface UseFloorsByBuildingResult {
  floors: FloorOption[];
  loading: boolean;
}

interface FloorsSnapshot {
  readonly floors: FloorOption[];
  readonly loading: boolean;
}

type FloorsListener = (snapshot: FloorsSnapshot) => void;

/** A shared, reference-counted `FLOORS`-per-building subscription (SSoT). */
interface FloorsCacheEntry {
  snapshot: FloorsSnapshot;
  readonly listeners: Set<FloorsListener>;
  unsubscribe: () => void;
}

/** Module-level cache: ONE live listener per `userId::buildingId`. */
const floorsCache = new Map<string, FloorsCacheEntry>();

function cacheKey(userId: string, buildingId: string): string {
  return `${userId}::${buildingId}`;
}

function mapFloorsResult(documents: ReadonlyArray<Record<string, unknown> & { id: string }>): FloorOption[] {
  return documents
    .map((data) => ({
      id: data.id,
      number: typeof data.number === 'number' ? data.number : 0,
      name: (data.name as string) || '',
      buildingId: (data.buildingId as string) || '',
      longName: typeof data.longName === 'string' ? data.longName : undefined,
      kind: isFloorKind(data.kind) ? data.kind : undefined,
      elevation: typeof data.elevation === 'number' ? data.elevation : undefined,
    }))
    .sort((a, b) => a.number - b.number);
}

/**
 * Resolve (creating if needed) the shared cache entry for a (user, building) and
 * register `listener`. Opens the single `onSnapshot` on first subscriber; the
 * returned disposer removes the listener and tears the Firestore listener down
 * when the last subscriber leaves (reference counting).
 */
function subscribeShared(userId: string, buildingId: string, listener: FloorsListener): () => void {
  const key = cacheKey(userId, buildingId);
  let entry = floorsCache.get(key);

  if (!entry) {
    const created: FloorsCacheEntry = {
      snapshot: { floors: [], loading: true },
      listeners: new Set<FloorsListener>(),
      unsubscribe: () => {},
    };
    floorsCache.set(key, created);
    created.unsubscribe = firestoreQueryService.subscribe<Record<string, unknown> & { id: string }>(
      'FLOORS',
      (result) => {
        created.snapshot = { floors: mapFloorsResult(result.documents), loading: false };
        created.listeners.forEach((l) => l(created.snapshot));
      },
      (err) => {
        logger.error('Failed to subscribe to floors', { error: err.message, buildingId });
        created.snapshot = { floors: [], loading: false };
        created.listeners.forEach((l) => l(created.snapshot));
      },
      { constraints: [where('buildingId', '==', buildingId)] },
    );
    entry = created;
  }

  const liveEntry = entry;
  liveEntry.listeners.add(listener);
  // Emit the current snapshot immediately so a late subscriber is not stuck on the
  // initial `loading` state when the listener has already delivered data.
  listener(liveEntry.snapshot);

  return () => {
    liveEntry.listeners.delete(listener);
    if (liveEntry.listeners.size === 0) {
      liveEntry.unsubscribe();
      floorsCache.delete(key);
    }
  };
}

export function useFloorsByBuilding(
  buildingId: string | null | undefined,
  enabled: boolean = true,
): UseFloorsByBuildingResult {
  const { user } = useAuth();
  const userId = user?.uid ?? null;
  const [snapshot, setSnapshot] = useState<FloorsSnapshot>({ floors: [], loading: false });

  useEffect(() => {
    if (!enabled || !buildingId || !userId) {
      setSnapshot({ floors: [], loading: false });
      return;
    }
    setSnapshot((prev) => (prev.loading ? prev : { floors: prev.floors, loading: true }));
    const unsubscribe = subscribeShared(userId, buildingId, setSnapshot);
    return () => unsubscribe();
  }, [enabled, buildingId, userId]);

  return { floors: snapshot.floors, loading: snapshot.loading };
}
