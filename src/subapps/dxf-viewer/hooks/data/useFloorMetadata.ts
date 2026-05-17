'use client';

/**
 * ADR-358 Phase 9 — Floor metadata subscription (single doc).
 *
 * Fetches one `FLOORS/{floorId}` document via `firestoreQueryService.subscribeDoc`
 * (SSoT, ADR-355) so the equality guard (ADR-361) skips no-op snapshots and
 * downstream consumers (`StairToolFloorBridge`, `RibbonStairFloorInfoWidget`)
 * don't re-render on every hourly server timestamp tick.
 *
 * The hook returns a stable `FloorMetadata` snapshot. When `floorId` is absent
 * (no floor in scope) the hook short-circuits and returns `null` — caller must
 * treat that as "no floor link available".
 *
 * Floor unit convention: `height` and `elevation` are stored in METERS in the
 * `FLOORS` collection (see `useFloorsTabState.FloorRecord`). Stair geometry
 * stores `multiStoryConfig.storyHeight` in MILLIMETERS. Consumers are
 * responsible for the m → mm conversion at the integration boundary.
 */

import { useEffect, useState } from 'react';
import type { DocumentData } from 'firebase/firestore';
import { firestoreQueryService } from '@/services/firestore';

export interface FloorMetadata {
  readonly id: string;
  readonly number: number | null;
  readonly name: string;
  /** Meters. `null` when the floor row has no elevation set. */
  readonly elevation: number | null;
  /** Meters. `null` when the floor row has no height set. */
  readonly height: number | null;
  readonly buildingId: string;
  readonly hasFloorplan: boolean;
}

interface FloorDoc extends DocumentData {
  id?: string;
  number?: number;
  name?: string;
  elevation?: number | null;
  height?: number | null;
  buildingId?: string;
  hasFloorplan?: boolean;
}

function toMetadata(floorId: string, doc: FloorDoc | null): FloorMetadata | null {
  if (!doc) return null;
  return {
    id: doc.id ?? floorId,
    number: typeof doc.number === 'number' ? doc.number : null,
    name: typeof doc.name === 'string' ? doc.name : '',
    elevation: typeof doc.elevation === 'number' ? doc.elevation : null,
    height: typeof doc.height === 'number' ? doc.height : null,
    buildingId: typeof doc.buildingId === 'string' ? doc.buildingId : '',
    hasFloorplan: doc.hasFloorplan === true,
  };
}

export function useFloorMetadata(floorId: string | null | undefined): FloorMetadata | null {
  const [metadata, setMetadata] = useState<FloorMetadata | null>(null);

  useEffect(() => {
    if (!floorId) {
      setMetadata(null);
      return;
    }
    const unsubscribe = firestoreQueryService.subscribeDoc<FloorDoc>(
      'FLOORS',
      floorId,
      (doc) => setMetadata(toMetadata(floorId, doc)),
      (err) => {
        console.error('[useFloorMetadata] subscribe failed', err);
        setMetadata(null);
      },
    );
    return () => unsubscribe();
  }, [floorId]);

  return metadata;
}
