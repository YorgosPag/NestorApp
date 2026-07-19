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

import { firestoreQueryService } from '@/services/firestore';
import {
  hydrateWall,
  hydrateSlab,
  hydrateBeam,
  hydrateColumn,
  hydrateOpening,
  hydrateSlabOpening,
  hydrateStair,
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
import {
  isWallHostedOpening,
  type OpeningEntity,
} from '@/subapps/dxf-viewer/bim/types/opening-types';
import type { SlabOpeningEntity } from '@/subapps/dxf-viewer/bim/types/slab-opening-types';
import type { StairDoc, StairEntity } from '@/subapps/dxf-viewer/bim/types/stair-types';

// ADR-370 v2 (full parity) — hatch / foundation / furniture reuse each type's EXPORTED
// SSoT `docToEntity` (no read-only mirror; N.18 clone-free). Entity shapes are derived
// via `ReturnType` so this hook needs no per-type entity-import path.
import { hatchDocToEntity, type HatchDoc } from '@/subapps/dxf-viewer/bim/hatch/hatch-firestore-service';
import { foundationDocToEntity, type FoundationDoc } from '@/subapps/dxf-viewer/bim/foundations/foundation-firestore-service';
import { furnitureDocToEntity } from '@/subapps/dxf-viewer/hooks/data/furniture-persistence-helpers';
import type { FurnitureDoc } from '@/subapps/dxf-viewer/bim/furniture/furniture-firestore-service';
// ADR-420 — BIM entities are scoped by the stable building-storey `floorId` (not the
// volatile file `floorplanId`). Read-only MUST query with the SAME SSoT the editor's
// services use, else imported entities (whose `floorplanId` mirrors `floorId`) are missed.
import { resolveBimScope } from '@/subapps/dxf-viewer/bim/persistence/bim-floor-scope';

type HatchEntity = ReturnType<typeof hatchDocToEntity>;
type FoundationEntity = ReturnType<typeof foundationDocToEntity>;
type FurnitureEntity = ReturnType<typeof furnitureDocToEntity>;

export interface FloorplanBimSnapshot {
  readonly walls: ReadonlyArray<WallEntity>;
  readonly slabs: ReadonlyArray<SlabEntity>;
  readonly beams: ReadonlyArray<BeamEntity>;
  readonly columns: ReadonlyArray<ColumnEntity>;
  readonly openings: ReadonlyArray<OpeningEntity>;
  readonly slabOpenings: ReadonlyArray<SlabOpeningEntity>;
  readonly stairs: ReadonlyArray<StairEntity>;
  // ADR-370 v2 (full parity) — additional persisted BIM types now rendered read-only.
  readonly hatches: ReadonlyArray<HatchEntity>;
  readonly foundations: ReadonlyArray<FoundationEntity>;
  readonly furnitures: ReadonlyArray<FurnitureEntity>;
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
  stairs: [],
  hatches: [],
  foundations: [],
  furnitures: [],
  isLoading: false,
  hasAny: false,
};

/** Synthetic floorplanId pattern from `adaptFloorFloorplanToFileRecord` fallback path. */
const SYNTHETIC_FLOORPLAN_PREFIX = /^floor_floorplan_/;

/**
 * ADR-420 scope inputs for the read-only feed. `floorId` (building-storey, `flr_*`)
 * is the durable scope key the editor's persistence services query on; `floorplanId`
 * (source DXF file id) is provenance + legacy fallback.
 */
export interface FloorplanBimScope {
  readonly projectId: string | null | undefined;
  readonly floorId: string | null | undefined;
  readonly floorplanId: string | null | undefined;
}

/** Firestore scope constraint values, or `null` when the view cannot host BIM entities. */
interface ResolvedScope {
  readonly projectId: string;
  readonly scopeKey: 'floorId' | 'floorplanId';
  readonly scopeValue: string;
}

function resolveScope(scope: FloorplanBimScope | null | undefined): ResolvedScope | null {
  const projectId = scope?.projectId || undefined;
  const floorId = scope?.floorId || undefined;
  const floorplanId = scope?.floorplanId || undefined;
  if (!projectId) return null;
  // A synthetic file id (no real FileRecord) never had entities; only reject it when
  // there is ALSO no durable floorId to fall back on.
  if (!floorId && (!floorplanId || SYNTHETIC_FLOORPLAN_PREFIX.test(floorplanId))) return null;
  // Reuse the editor's SSoT: floorId preferred, floorplanId legacy fallback.
  const resolved = resolveBimScope({ projectId, floorplanId: floorplanId ?? floorId!, floorId });
  return { projectId, scopeKey: resolved.key, scopeValue: resolved.value };
}

function useGuardedDocs<T extends { id: string }>(
  collectionKey:
    | 'FLOORPLAN_WALLS'
    | 'FLOORPLAN_SLABS'
    | 'FLOORPLAN_BEAMS'
    | 'FLOORPLAN_COLUMNS'
    | 'FLOORPLAN_OPENINGS'
    | 'FLOORPLAN_SLAB_OPENINGS'
    | 'FLOORPLAN_STAIRS'
    | 'FLOORPLAN_HATCHES'
    | 'FLOORPLAN_FOUNDATIONS'
    | 'FLOORPLAN_FURNITURE',
  scope: ResolvedScope | null,
): { docs: ReadonlyArray<T>; loaded: boolean } {
  const [state, setState] = useState<{ docs: ReadonlyArray<T>; loaded: boolean }>({
    docs: [],
    loaded: false,
  });

  const projectId = scope?.projectId ?? null;
  const scopeKey = scope?.scopeKey ?? null;
  const scopeValue = scope?.scopeValue ?? null;

  useEffect(() => {
    if (!projectId || !scopeKey || !scopeValue) {
      setState((prev) => (prev.docs.length === 0 && prev.loaded === false ? prev : { docs: [], loaded: false }));
      return;
    }

    let prevDocs: ReadonlyArray<T> | null = null;

    const unsub = firestoreQueryService.subscribe<T>(
      collectionKey,
      (result) => {
        const next = result.documents;
        if (prevDocs && dequal(prevDocs, next)) {
          setState((s) => (s.loaded ? s : { docs: s.docs, loaded: true }));
          return;
        }
        prevDocs = next;
        setState({ docs: next, loaded: true });
      },
      () => {
        setState((s) => ({ docs: s.docs, loaded: true }));
      },
      {
        // ADR-420 scope (projectId + floorId|floorplanId), mirroring the editor's
        // `buildBimScopeConstraints`. companyId auto-applied by firestoreQueryService
        // (tenant SSoT, ADR-294/356). Same composite index the live services use.
        constraints: [where('projectId', '==', projectId), where(scopeKey, '==', scopeValue)],
      },
    );

    return () => {
      unsub();
    };
  }, [collectionKey, projectId, scopeKey, scopeValue]);

  return state;
}

export function useFloorplanBimEntities(
  scope: FloorplanBimScope | null | undefined,
): FloorplanBimSnapshot {
  const projectId = scope?.projectId ?? null;
  const floorId = scope?.floorId ?? null;
  const floorplanId = scope?.floorplanId ?? null;
  const resolved = useMemo(
    () => resolveScope({ projectId, floorId, floorplanId }),
    [projectId, floorId, floorplanId],
  );

  const wallsRes = useGuardedDocs<WallDoc>('FLOORPLAN_WALLS', resolved);
  const slabsRes = useGuardedDocs<SlabDoc>('FLOORPLAN_SLABS', resolved);
  const beamsRes = useGuardedDocs<BeamDoc>('FLOORPLAN_BEAMS', resolved);
  const columnsRes = useGuardedDocs<ColumnDoc>('FLOORPLAN_COLUMNS', resolved);
  const openingsRes = useGuardedDocs<OpeningDoc>('FLOORPLAN_OPENINGS', resolved);
  const slabOpeningsRes = useGuardedDocs<SlabOpeningDoc>('FLOORPLAN_SLAB_OPENINGS', resolved);
  const stairsRes = useGuardedDocs<StairDoc>('FLOORPLAN_STAIRS', resolved);
  // ADR-370 v2 — full-parity feed for the remaining persisted BIM types with an
  // exported SSoT `docToEntity`.
  const hatchesRes = useGuardedDocs<HatchDoc>('FLOORPLAN_HATCHES', resolved);
  const foundationsRes = useGuardedDocs<FoundationDoc>('FLOORPLAN_FOUNDATIONS', resolved);
  const furnitureRes = useGuardedDocs<FurnitureDoc>('FLOORPLAN_FURNITURE', resolved);

  return useMemo<FloorplanBimSnapshot>(() => {
    if (!resolved) return EMPTY_SNAPSHOT;

    const walls = wallsRes.docs.map(hydrateWall);
    const wallById = new Map<string, WallEntity>();
    for (const w of walls) wallById.set(w.id, w);

    const slabs = slabsRes.docs.map(hydrateSlab);
    const beams = beamsRes.docs.map(hydrateBeam);
    const columns = columnsRes.docs.map(hydrateColumn);
    const slabOpenings = slabOpeningsRes.docs.map(hydrateSlabOpening);
    const stairs = stairsRes.docs.map(hydrateStair);
    // ADR-370 v2 — reuse each type's exported SSoT hydrator verbatim (no mirror).
    const hatches = hatchesRes.docs.map(hatchDocToEntity);
    const foundations = foundationsRes.docs.map(foundationDocToEntity);
    const furnitures = furnitureRes.docs.map(furnitureDocToEntity);

    const openings: OpeningEntity[] = [];
    for (const od of openingsRes.docs) {
      // ADR-615 — a self-hosted opening carries no `wallId`; a `null` host is its
      // normal state and hydration synthesizes the host from `selfHost`.
      const host = isWallHostedOpening(od) ? wallById.get(od.params.wallId) ?? null : null;
      const hydrated = hydrateOpening(od, host);
      if (hydrated) openings.push(hydrated);
    }

    const isLoading = !(
      wallsRes.loaded &&
      slabsRes.loaded &&
      beamsRes.loaded &&
      columnsRes.loaded &&
      openingsRes.loaded &&
      slabOpeningsRes.loaded &&
      stairsRes.loaded &&
      hatchesRes.loaded &&
      foundationsRes.loaded &&
      furnitureRes.loaded
    );

    const hasAny =
      walls.length +
        slabs.length +
        beams.length +
        columns.length +
        openings.length +
        slabOpenings.length +
        stairs.length +
        hatches.length +
        foundations.length +
        furnitures.length >
      0;

    return {
      walls, slabs, beams, columns, openings, slabOpenings, stairs,
      hatches, foundations, furnitures,
      isLoading, hasAny,
    };
  }, [
    resolved,
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
    stairsRes.docs,
    stairsRes.loaded,
    hatchesRes.docs,
    hatchesRes.loaded,
    foundationsRes.docs,
    foundationsRes.loaded,
    furnitureRes.docs,
    furnitureRes.loaded,
  ]);
}
