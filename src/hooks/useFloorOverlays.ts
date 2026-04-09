'use client';

/**
 * =============================================================================
 * ENTERPRISE: Floor Overlays Hook (Read-Only Bridge)
 * =============================================================================
 *
 * Loads polygon overlays from Firestore based on `floorId`.
 * Read-only — never writes to `dxf-overlay-levels`.
 *
 * 2-Step Firestore Query:
 * 1. Query `dxf-viewer-levels` where floorId == targetFloorId → get level IDs
 * 2. Per level: onSnapshot on `dxf-overlay-levels/{levelId}/items` → merge results
 *
 * @module hooks/useFloorOverlays
 * @enterprise ADR-237 / SPEC-237B — Overlay Bridge Core
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { createModuleLogger } from '@/lib/telemetry';
import { useEntityStatusResolver } from './useEntityStatusResolver';
import type { OverlayKind } from '@/subapps/dxf-viewer/overlays/types';
import type { PropertyStatus } from '@/constants/property-statuses-enterprise';

const logger = createModuleLogger('useFloorOverlays');

// ============================================================================
// TYPES
// ============================================================================

/** Internal raw overlay item — before entity status enrichment */
interface RawFloorOverlayItem {
  id: string;
  polygon: Array<{ x: number; y: number }>;
  kind: OverlayKind;
  status?: PropertyStatus;
  label?: string;
  linked?: {
    propertyId?: string;
    parkingId?: string;
    storageId?: string;
  };
  levelId: string;
}

/** Public enriched overlay item — includes dynamic resolvedStatus (ADR-258 SPEC-258C) */
export interface FloorOverlayItem extends RawFloorOverlayItem {
  /** @deprecated ADR-258: Use resolvedStatus instead — static status baked at draw-time */
  status?: PropertyStatus;
  /** Dynamic status resolved from linked entity's commercialStatus (ADR-258 SPEC-258C) */
  resolvedStatus: PropertyStatus;
}

interface UseFloorOverlaysReturn {
  overlays: ReadonlyArray<FloorOverlayItem>;
  loading: boolean;
  error: string | null;
}

// ============================================================================
// CONSTANTS
// ============================================================================

// SSoT: Collection names from centralized config
import { COLLECTIONS } from '@/config/firestore-collections';
const LEVELS_COLLECTION = COLLECTIONS.DXF_VIEWER_LEVELS;
const OVERLAYS_COLLECTION = COLLECTIONS.DXF_OVERLAY_LEVELS;

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Normalize polygon from Firestore to {x, y}[] format.
 * Handles 3 storage formats (same as overlay-store.tsx):
 * 1. {x, y} objects (preferred) → pass through
 * 2. flat [x1, y1, x2, y2, ...] → pair up
 * 3. [[x,y], [x,y], ...] tuples → convert
 */
function normalizePolygon(raw: unknown): Array<{ x: number; y: number }> {
  if (!Array.isArray(raw) || raw.length === 0) return [];

  const first = raw[0];

  // Format 1: {x, y} objects
  if (typeof first === 'object' && first !== null && 'x' in first && 'y' in first) {
    return raw as Array<{ x: number; y: number }>;
  }

  // Format 2: flat numbers [x1, y1, x2, y2, ...]
  if (typeof first === 'number') {
    const result: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < raw.length; i += 2) {
      result.push({ x: raw[i] as number, y: raw[i + 1] as number });
    }
    return result;
  }

  // Format 3: nested tuples [[x,y], [x,y], ...]
  if (Array.isArray(first) && first.length === 2) {
    return raw.map((pair) => ({
      x: (pair as [number, number])[0],
      y: (pair as [number, number])[1],
    }));
  }

  return [];
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * ENTERPRISE: Read-Only Floor Overlays Hook
 *
 * Loads overlays from Firestore for all levels mapped to a given floorId.
 * Real-time via onSnapshot — changes in DXF Viewer appear automatically.
 *
 * @param floorId - The floor ID to load overlays for (from Level.floorId)
 */
export function useFloorOverlays(floorId: string | null): UseFloorOverlaysReturn {
  const [rawOverlays, setRawOverlays] = useState<ReadonlyArray<RawFloorOverlayItem>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track active overlay subscriptions for cleanup
  const overlayUnsubsRef = useRef<Unsubscribe[]>([]);

  useEffect(() => {
    // Cleanup helper
    const cleanupOverlaySubs = () => {
      overlayUnsubsRef.current.forEach((unsub) => unsub());
      overlayUnsubsRef.current = [];
    };

    if (!floorId) {
      setRawOverlays([]);
      setLoading(false);
      setError(null);
      return cleanupOverlaySubs;
    }

    setLoading(true);
    setError(null);

    // Accumulator: levelId → overlay items (for merge across levels)
    const overlaysByLevel = new Map<string, RawFloorOverlayItem[]>();

    const mergeAndSet = () => {
      const merged: RawFloorOverlayItem[] = [];
      overlaysByLevel.forEach((items) => merged.push(...items));
      setRawOverlays(merged);
    };

    // Step 1: Query levels where floorId matches
    const levelsRef = collection(db, LEVELS_COLLECTION);
    const levelsQuery = query(levelsRef, where('floorId', '==', floorId));

    const unsubLevels = onSnapshot(
      levelsQuery,
      (levelsSnapshot) => {
        // Clean up previous overlay subscriptions
        cleanupOverlaySubs();
        overlaysByLevel.clear();

        const levelIds = levelsSnapshot.docs.map((doc) => doc.id);

        if (levelIds.length === 0) {
          setRawOverlays([]);
          setLoading(false);
          logger.debug('No levels found for floor', { data: { floorId } });
          return;
        }

        logger.debug('Found levels for floor', { data: { floorId, levelCount: levelIds.length } });

        // Step 2: Subscribe to overlay items per level
        let pendingInitial = levelIds.length;

        levelIds.forEach((levelId) => {
          const itemsRef = collection(db, `${OVERLAYS_COLLECTION}/${levelId}/items`);
          const itemsQuery = query(itemsRef, orderBy('createdAt', 'asc'));

          const unsubItems = onSnapshot(
            itemsQuery,
            (itemsSnapshot) => {
              const items: RawFloorOverlayItem[] = [];

              itemsSnapshot.docs.forEach((doc) => {
                const data = doc.data() as Record<string, unknown>;
                const kind = data.kind as OverlayKind | undefined;

                // Filter out footprints — not shown on public page
                if (kind === 'footprint') return;

                const polygon = normalizePolygon(data.polygon);
                if (polygon.length < 3) return; // Skip invalid polygons

                items.push({
                  id: doc.id,
                  polygon,
                  kind: kind ?? 'property',
                  status: data.status as PropertyStatus | undefined,
                  label: data.label as string | undefined,
                  linked: data.linked as FloorOverlayItem['linked'] | undefined,
                  levelId,
                });
              });

              overlaysByLevel.set(levelId, items);
              mergeAndSet();

              // Track initial loading
              if (pendingInitial > 0) {
                pendingInitial--;
                if (pendingInitial === 0) {
                  setLoading(false);
                }
              }
            },
            (err) => {
              logger.error('Overlay subscription error', { error: err, data: { levelId } });
              setError(err.message);
              setLoading(false);
            },
          );

          overlayUnsubsRef.current.push(unsubItems);
        });
      },
      (err) => {
        logger.error('Levels query error', { error: err, data: { floorId } });
        setError(err.message);
        setLoading(false);
      },
    );

    return () => {
      unsubLevels();
      cleanupOverlaySubs();
    };
  }, [floorId]);

  // ── ADR-258 SPEC-258C: Resolve entity statuses in real-time ─────────
  const statusMap = useEntityStatusResolver(rawOverlays);

  const enrichedOverlays = useMemo<ReadonlyArray<FloorOverlayItem>>(() =>
    rawOverlays.map((overlay) => ({
      ...overlay,
      resolvedStatus: statusMap.get(overlay.id) ?? overlay.status ?? 'unavailable',
    })),
    [rawOverlays, statusMap]
  );

  return { overlays: enrichedOverlays, loading, error };
}

export default useFloorOverlays;
