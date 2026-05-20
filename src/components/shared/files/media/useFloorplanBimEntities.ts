'use client';

/**
 * ADR-370 — Read-only BIM entity subscription hook for Properties floorplan tab.
 *
 * Subscribes to the 6 BIM Firestore collections filtered by `floorplanId`,
 * applies a hash-equality guard (per memory rule "Firestore subscribe equality
 * guard" — second layer on top of ADR-361 service-level guard), and hydrates
 * docs → scene entities via SSoT `computeXxxGeometry()` functions.
 *
 * Companies / tenant isolation: `firestoreQueryService.subscribe` auto-applies
 * the `companyId` constraint from auth context (no manual `where('companyId', …)`
 * needed at call site — see ADR-356).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-370-bim-readonly-visualization.md
 */

import { useEffect, useMemo, useState } from 'react';
import { dequal } from 'dequal';
import { where } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

import { firestoreQueryService } from '@/services/firestore';
import {
  hydrateWall,
  hydrateSlab,
  hydrateBeam,
  hydrateColumn,
  hydrateOpening,
  hydrateSlabOpening,
} from '@/components/shared/files/media/bim-readonly-hydration';

import type { WallDoc } from '@/subapps/dxf-viewer/bim/walls/wall-firestore-service';
import type { SlabDoc } from '@/subapps/dxf-viewer/bim/slabs/slab-firestore-service';
import type { BeamDoc } from '@/subapps/dxf-viewer/bim/beams/beam-firestore-service';
import type { ColumnDoc } from '@/subapps/dxf-viewer/bim/columns/column-firestore-service';
import type { OpeningDoc } from '@/subapps/dxf-viewer/bim/walls/opening-firestore-service';
import type { SlabOpeningDoc } from '@/subapps/dxf-viewer/bim/slab-openings/slab-opening-firestore-service';

import type { WallEntity } from '@/subapps/dxf-viewer/bim/types/wall-types';
import type { SlabEntity } from '@/subapps/dxf-viewer/bim/types/slab-types';
import type { BeamEntity } from '@/subapps/dxf-viewer/bim/types/beam-types';
import type { ColumnEntity } from '@/subapps/dxf-viewer/bim/types/column-types';
import type { OpeningEntity } from '@/subapps/dxf-viewer/bim/types/opening-types';
import type { SlabOpeningEntity } from '@/subapps/dxf-viewer/bim/types/slab-opening-types';

export interface FloorplanBimSnapshot {
  readonly walls: ReadonlyArray<WallEntity>;
  readonly slabs: ReadonlyArray<SlabEntity>;
  readonly beams: ReadonlyArray<BeamEntity>;
  readonly columns: ReadonlyArray<ColumnEntity>;
  readonly openings: ReadonlyArray<OpeningEntity>;
  readonly slabOpenings: ReadonlyArray<SlabOpeningEntity>;
  readonly isLoading: boolean;
  readonly hasAny: boolean;
}

const EMPTY_SNAPSHOT: FloorplanBimSnapshot = {
  walls: [],
  slabs: [],
  beams: [],
  columns: [],
  openings: [],
  slabOpenings: [],
  isLoading: false,
  hasAny: false,
};

/** Synthetic floorplanId pattern from `adaptFloorFloorplanToFileRecord` fallback path. */
const SYNTHETIC_FLOORPLAN_PREFIX = /^floor_floorplan_/;

function isQueryable(floorplanId: string | null | undefined): floorplanId is string {
  return Boolean(floorplanId) && !SYNTHETIC_FLOORPLAN_PREFIX.test(floorplanId as string);
}

function useGuardedDocs<T extends { id: string }>(
  collectionKey:
    | 'FLOORPLAN_WALLS'
    | 'FLOORPLAN_SLABS'
    | 'FLOORPLAN_BEAMS'
    | 'FLOORPLAN_COLUMNS'
    | 'FLOORPLAN_OPENINGS'
    | 'FLOORPLAN_SLAB_OPENINGS',
  floorplanId: string | null,
): { docs: ReadonlyArray<T>; loaded: boolean } {
  const [state, setState] = useState<{ docs: ReadonlyArray<T>; loaded: boolean }>({
    docs: [],
    loaded: false,
  });

  useEffect(() => {
    if (!floorplanId) {
      setState((prev) => (prev.docs.length === 0 && prev.loaded === false ? prev : { docs: [], loaded: false }));
      return;
    }

    let prevDocs: ReadonlyArray<T> | null = null;

    // eslint-disable-next-line no-console
    console.log('[bim-readonly][subscribe:start]', { collectionKey, floorplanId });

    const unsub = firestoreQueryService.subscribe<T>(
      collectionKey,
      (result) => {
        const next = result.documents;
        // eslint-disable-next-line no-console
        console.log('[bim-readonly][snapshot]', {
          collectionKey,
          floorplanId,
          count: next.length,
          ids: next.slice(0, 3).map((d) => d.id),
        });
        if (prevDocs && dequal(prevDocs, next)) {
          setState((s) => (s.loaded ? s : { docs: s.docs, loaded: true }));
          return;
        }
        prevDocs = next;
        setState({ docs: next, loaded: true });
      },
      (err) => {
        // eslint-disable-next-line no-console
        console.warn('[bim-readonly][error]', {
          collectionKey,
          floorplanId,
          code: (err as { code?: string }).code,
          message: err.message,
          name: err.name,
        });
        setState((s) => ({ docs: s.docs, loaded: true }));
      },
      {
        // ADR-294: companyId constraint applied automatically by firestoreQueryService (tenant SSoT).
        constraints: [where('floorplanId', '==', floorplanId)],
      },
    );

    return () => {
      unsub();
    };
  }, [collectionKey, floorplanId]);

  return state;
}

export function useFloorplanBimEntities(
  floorplanId: string | null | undefined,
): FloorplanBimSnapshot {
  const activeId = isQueryable(floorplanId) ? floorplanId : null;

  // eslint-disable-next-line no-console
  console.log('[bim-readonly][hook]', {
    floorplanIdInput: floorplanId,
    activeId,
    isSynthetic: floorplanId ? SYNTHETIC_FLOORPLAN_PREFIX.test(floorplanId) : false,
  });

  useEffect(() => {
    const user = getAuth().currentUser;
    if (!user) {
      // eslint-disable-next-line no-console
      console.warn('[bim-readonly][token] NO_USER');
      return;
    }
    user.getIdTokenResult().then((t) => {
      // eslint-disable-next-line no-console
      console.log('[bim-readonly][token]', {
        uid: user.uid,
        email: user.email,
        companyId: t.claims.companyId,
        globalRole: t.claims.globalRole,
        effectiveCompanyId: t.claims.effectiveCompanyId,
        allClaims: t.claims,
      });
    });
  }, []);

  const wallsRes = useGuardedDocs<WallDoc>('FLOORPLAN_WALLS', activeId);
  const slabsRes = useGuardedDocs<SlabDoc>('FLOORPLAN_SLABS', activeId);
  const beamsRes = useGuardedDocs<BeamDoc>('FLOORPLAN_BEAMS', activeId);
  const columnsRes = useGuardedDocs<ColumnDoc>('FLOORPLAN_COLUMNS', activeId);
  const openingsRes = useGuardedDocs<OpeningDoc>('FLOORPLAN_OPENINGS', activeId);
  const slabOpeningsRes = useGuardedDocs<SlabOpeningDoc>('FLOORPLAN_SLAB_OPENINGS', activeId);

  return useMemo<FloorplanBimSnapshot>(() => {
    if (!activeId) return EMPTY_SNAPSHOT;

    const walls = wallsRes.docs.map(hydrateWall);
    const wallById = new Map<string, WallEntity>();
    for (const w of walls) wallById.set(w.id, w);

    const slabs = slabsRes.docs.map(hydrateSlab);
    const beams = beamsRes.docs.map(hydrateBeam);
    const columns = columnsRes.docs.map(hydrateColumn);
    const slabOpenings = slabOpeningsRes.docs.map(hydrateSlabOpening);

    const openings: OpeningEntity[] = [];
    for (const od of openingsRes.docs) {
      const host = wallById.get(od.params.wallId) ?? null;
      const hydrated = hydrateOpening(od, host);
      if (hydrated) openings.push(hydrated);
    }

    const isLoading = !(
      wallsRes.loaded &&
      slabsRes.loaded &&
      beamsRes.loaded &&
      columnsRes.loaded &&
      openingsRes.loaded &&
      slabOpeningsRes.loaded
    );

    const hasAny =
      walls.length +
        slabs.length +
        beams.length +
        columns.length +
        openings.length +
        slabOpenings.length >
      0;

    // eslint-disable-next-line no-console
    console.log('[bim-readonly][snapshot:return]', {
      activeId,
      isLoading,
      hasAny,
      counts: {
        walls: walls.length,
        slabs: slabs.length,
        beams: beams.length,
        columns: columns.length,
        openings: openings.length,
        slabOpenings: slabOpenings.length,
      },
    });

    return { walls, slabs, beams, columns, openings, slabOpenings, isLoading, hasAny };
  }, [
    activeId,
    wallsRes.docs,
    wallsRes.loaded,
    slabsRes.docs,
    slabsRes.loaded,
    beamsRes.docs,
    beamsRes.loaded,
    columnsRes.docs,
    columnsRes.loaded,
    openingsRes.docs,
    openingsRes.loaded,
    slabOpeningsRes.docs,
    slabOpeningsRes.loaded,
  ]);
}
