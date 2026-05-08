'use client';

/**
 * =============================================================================
 * ENTERPRISE: Floor Overlays Hook (Read-Only Bridge — Multi-Kind)
 * =============================================================================
 *
 * Loads multi-kind overlays from `floorplan_overlays` for a given `floorId`.
 * Read-only — never writes. Single-collection subscription via the SSoT
 * tenant-aware `firestoreQueryService` (auto-injects `where('companyId','==',ctx)`).
 *
 * Phase 9 STEP F (ADR-340) replaces the legacy 2-step level fan-out
 * (dxf_viewer_levels → dxf_overlay_levels/{levelId}/items) with a single
 * subscription on `floorplan_overlays` indexed by `(companyId, floorId, createdAt)`.
 *
 * Output `FloorOverlayItem` extends the SSoT `FloorplanOverlay` and augments
 * with two back-compat fields:
 *   - `polygon: Point2D[]` — vertices for polygon geometry, `[]` for non-polygon.
 *     Kept so the existing legacy renderer / hit-test code keeps working until
 *     STEP G migrates them to `geometry`-aware dispatch.
 *   - `kind: OverlayKind` — derived from `role` (property/parking/storage map
 *     1:1; footprint maps to 'footprint'; annotation/auxiliary map to 'property'
 *     fallback to keep legacy enum bound — but those overlays are filtered out
 *     before reaching status-resolver consumers).
 *
 * Footprints (`role: 'footprint'`) are filtered out — not shown on public page.
 *
 * @module hooks/useFloorOverlays
 * @enterprise ADR-340 §3.6 / Phase 9 STEP F
 */

import { useState, useEffect, useMemo } from 'react';
import { where, orderBy, type Unsubscribe } from 'firebase/firestore';
import { createModuleLogger } from '@/lib/telemetry';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import { useEntityStatusResolver } from './useEntityStatusResolver';
import type { OverlayKind } from '@/subapps/dxf-viewer/overlays/types';
import type { PropertyStatus } from '@/constants/property-statuses-enterprise';
import {
  OVERLAY_GEOMETRY_TYPES,
  type FloorplanOverlay,
  type OverlayGeometry,
  type OverlayRole,
  type OverlayLinked,
  type Point2D,
} from '@/types/floorplan-overlays';

const logger = createModuleLogger('useFloorOverlays');

// ============================================================================
// TYPES
// ============================================================================

/** Internal raw overlay — matches the Firestore document shape (post-Phase-9). */
interface RawFloorOverlayItem extends FloorplanOverlay {
  /** @deprecated Phase 9 back-compat — vertices for polygon kind, [] otherwise. */
  polygon: Point2D[];
  /** @deprecated Phase 9 back-compat — derived from `role`. */
  kind: OverlayKind;
  /** @deprecated ADR-258 — superseded by `resolvedStatus`. */
  status?: PropertyStatus;
}

/** Public enriched overlay — adds `resolvedStatus` (ADR-258 SPEC-258C). */
export interface FloorOverlayItem extends RawFloorOverlayItem {
  resolvedStatus: PropertyStatus;
}

interface UseFloorOverlaysReturn {
  overlays: ReadonlyArray<FloorOverlayItem>;
  loading: boolean;
  error: string | null;
}

// ============================================================================
// HELPERS
// ============================================================================

/** Map SSoT `role` → legacy `OverlayKind` for back-compat consumers. */
function roleToKind(role: OverlayRole): OverlayKind {
  switch (role) {
    case 'property':
    case 'parking':
    case 'storage':
    case 'footprint':
      return role;
    default:
      // annotation / auxiliary — no exact legacy match. Use 'property' as
      // neutral fallback; status-resolver only acts when linked.<x>Id exists.
      return 'property';
  }
}

/** Extract polygon vertices for back-compat `polygon` field. */
function extractPolygon(geometry: OverlayGeometry): Point2D[] {
  return geometry.type === 'polygon' ? [...geometry.vertices] : [];
}

/** Validate the raw Firestore document against the SSoT geometry whitelist. */
function isValidGeometry(geometry: unknown): geometry is OverlayGeometry {
  if (!geometry || typeof geometry !== 'object') return false;
  const g = geometry as { type?: unknown };
  return typeof g.type === 'string' &&
    (OVERLAY_GEOMETRY_TYPES as ReadonlyArray<string>).includes(g.type);
}

/**
 * Normalize a raw Firestore overlay document into the local item shape.
 * Returns null for malformed / unsupported documents.
 */
function normalizeOverlay(raw: Record<string, unknown>): RawFloorOverlayItem | null {
  if (!isValidGeometry(raw.geometry)) {
    logger.debug('Skipping overlay with invalid geometry', { data: { id: raw.id } });
    return null;
  }
  if (typeof raw.role !== 'string') return null;

  const geometry = raw.geometry;
  const role = raw.role as OverlayRole;

  return {
    id: raw.id as string,
    companyId: (raw.companyId as string) ?? '',
    backgroundId: (raw.backgroundId as string) ?? '',
    floorId: (raw.floorId as string) ?? '',
    geometry,
    role,
    linked: raw.linked as OverlayLinked | undefined,
    label: raw.label as string | undefined,
    style: raw.style as FloorplanOverlay['style'],
    layer: raw.layer as string | undefined,
    createdAt: (raw.createdAt ?? 0) as RawFloorOverlayItem['createdAt'],
    updatedAt: (raw.updatedAt ?? 0) as RawFloorOverlayItem['updatedAt'],
    createdBy: (raw.createdBy as string) ?? '',
    polygon: extractPolygon(geometry),
    kind: roleToKind(role),
    status: raw.status as PropertyStatus | undefined,
  };
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * ENTERPRISE: Read-only multi-kind floor overlays.
 *
 * Subscribes to `floorplan_overlays` filtered by `floorId` (companyId
 * auto-injected). Footprints are filtered out for the public viewer.
 *
 * @param floorId - Floor ID to load overlays for
 */
export function useFloorOverlays(floorId: string | null): UseFloorOverlaysReturn {
  const [rawOverlays, setRawOverlays] = useState<ReadonlyArray<RawFloorOverlayItem>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!floorId) {
      setRawOverlays([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe: Unsubscribe = firestoreQueryService.subscribe<Record<string, unknown> & { id: string }>(
      'FLOORPLAN_OVERLAYS',
      (result) => {
        const items: RawFloorOverlayItem[] = [];
        for (const raw of result.documents) {
          const normalized = normalizeOverlay(raw);
          if (!normalized) continue;
          if (normalized.role === 'footprint') continue;
          items.push(normalized);
        }
        setRawOverlays(items);
        setLoading(false);
        logger.debug('Floor overlays loaded', { data: { floorId, count: items.length } });
      },
      (err) => {
        logger.error('Floorplan overlays subscription error', { error: err, data: { floorId } });
        setError(err.message);
        setLoading(false);
      },
      {
        constraints: [
          where('floorId', '==', floorId),
          orderBy('createdAt', 'asc'),
        ],
      },
    );

    return () => {
      unsubscribe();
    };
  }, [floorId]);

  // ── ADR-258 SPEC-258C: resolve entity statuses in real-time ────────────
  const statusMap = useEntityStatusResolver(rawOverlays);

  const enrichedOverlays = useMemo<ReadonlyArray<FloorOverlayItem>>(() =>
    rawOverlays.map((overlay) => ({
      ...overlay,
      resolvedStatus: statusMap.get(overlay.id) ?? overlay.status ?? 'unavailable',
    })),
    [rawOverlays, statusMap],
  );

  return { overlays: enrichedOverlays, loading, error };
}

export default useFloorOverlays;
