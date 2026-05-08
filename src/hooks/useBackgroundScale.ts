'use client';

/**
 * =============================================================================
 * ENTERPRISE: Background Scale Reader Hook (ADR-340 Phase 9 STEP I follow-up)
 * =============================================================================
 *
 * Subscribes to the active `floorplan_backgrounds` document for a given
 * `floorId` and exposes the persisted `BackgroundScale` (calibration metadata).
 * Read-only — never writes. Tenant-scoped via `firestoreQueryService` (auto-
 * injects `where('companyId','==',ctx)` per `tenant-config`).
 *
 * Consumed by:
 *   - `MeasureToolOverlay` — real-meter labels on transient measure tool
 *   - `CalibrateScaleDialog` opener affordance — to know whether the active
 *     background is already calibrated (UX hint)
 *   - `FloorplanGallery` callers (ListLayout, ReadOnlyMediaSubTabs, FloorPlanTab)
 *     to forward `unitsPerMeter` prop to the gallery.
 *
 * Lifecycle: a floor may have 0 or 1 backgrounds (Q2 single-target). Multiple
 * results → first-by-`createdAt` wins, but we don't enforce ordering server-side
 * since the cardinality invariant is upstream.
 *
 * @module hooks/useBackgroundScale
 * @enterprise ADR-340 Phase 9 STEP I follow-up (b)
 */

import { useEffect, useState } from 'react';
import { where, type Unsubscribe } from 'firebase/firestore';
import { createModuleLogger } from '@/lib/telemetry';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import type {
  BackgroundScale,
  BackgroundScaleSourceUnit,
} from '@/types/floorplan-overlays';

const logger = createModuleLogger('useBackgroundScale');

// ─── Public shape ─────────────────────────────────────────────────────────────

export interface UseBackgroundScaleResult {
  backgroundId: string | null;
  unitsPerMeter: number | null;
  sourceUnit: BackgroundScaleSourceUnit | null;
  isCalibrated: boolean;
  loading: boolean;
  error: string | null;
}

const EMPTY: UseBackgroundScaleResult = {
  backgroundId: null,
  unitsPerMeter: null,
  sourceUnit: null,
  isCalibrated: false,
  loading: false,
  error: null,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface RawBackgroundDoc {
  id: string;
  scale?: Partial<BackgroundScale>;
  createdAt?: number;
}

function pickActive(docs: ReadonlyArray<RawBackgroundDoc>): RawBackgroundDoc | null {
  if (!docs.length) return null;
  if (docs.length === 1) return docs[0];
  // Stable selection — earliest createdAt wins, ties broken by id.
  return [...docs].sort((a, b) => {
    const at = a.createdAt ?? 0;
    const bt = b.createdAt ?? 0;
    if (at !== bt) return at - bt;
    return a.id.localeCompare(b.id);
  })[0];
}

function readScale(doc: RawBackgroundDoc | null): {
  unitsPerMeter: number | null;
  sourceUnit: BackgroundScaleSourceUnit | null;
} {
  const s = doc?.scale;
  if (!s || typeof s.unitsPerMeter !== 'number' || s.unitsPerMeter <= 0) {
    return { unitsPerMeter: null, sourceUnit: null };
  }
  const unit = s.sourceUnit;
  const validUnit: BackgroundScaleSourceUnit | null =
    unit === 'mm' || unit === 'cm' || unit === 'm' || unit === 'pixel' ? unit : null;
  return { unitsPerMeter: s.unitsPerMeter, sourceUnit: validUnit };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Returns the calibration scale of the active background for a floor.
 * `floorId === null` → returns the EMPTY shape (no subscription).
 */
export function useBackgroundScale(floorId: string | null): UseBackgroundScaleResult {
  const [state, setState] = useState<UseBackgroundScaleResult>(EMPTY);

  useEffect(() => {
    if (!floorId) {
      setState(EMPTY);
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    const unsubscribe: Unsubscribe = firestoreQueryService.subscribe<RawBackgroundDoc>(
      'FLOORPLAN_BACKGROUNDS',
      (result) => {
        const active = pickActive(result.documents);
        const { unitsPerMeter, sourceUnit } = readScale(active);
        setState({
          backgroundId: active?.id ?? null,
          unitsPerMeter,
          sourceUnit,
          isCalibrated: unitsPerMeter !== null,
          loading: false,
          error: null,
        });
      },
      (err) => {
        logger.error('Background scale subscription error', {
          error: err,
          data: { floorId },
        });
        setState({ ...EMPTY, error: err.message });
      },
      {
        constraints: [where('floorId', '==', floorId)],
      },
    );

    return () => {
      unsubscribe();
    };
  }, [floorId]);

  return state;
}

export default useBackgroundScale;
