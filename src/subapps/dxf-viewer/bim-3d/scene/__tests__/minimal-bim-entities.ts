/**
 * SSoT minimal-but-REALISTIC BIM entity fixtures for the `BimSceneLayer` sync tests.
 *
 * The post-ADR-448/449/456-457 sync path does real geometry pre-work (wall start/end,
 * ceiling-slab kind, beam footprint/depth, slab-opening outline, column vertical profile)
 * BEFORE the mocked converters, so bare `{ id }` stubs crash. These builders give each entity
 * EXACTLY the fields its sync reads unconditionally — production entities always carry them.
 *
 * ONE source (N.0.2): the next sync field a converter-mocked `BimSceneLayer` test must satisfy
 * is added HERE, once — not re-copied into every test (was 3 hand-rolled `makeEntities`/`wallFloor`
 * copies, which a single geometry-read change forced editing in 3 places). Tests still own their
 * SCENARIO data inline (visibility modes, layer lookups, floor stacks); this module owns only the
 * boring "valid entity shape" boilerplate. The downstream geometry decoration (structural-finish
 * silhouette, slab-opening pick-mesh) is mocked / degenerate-guarded in the consuming tests.
 *
 * NOT a test suite (no `*.test` suffix) — pure fixtures, imported by the sibling suites.
 */

import { EMPTY_BIM_ENTITIES } from '../../stores/Bim3DEntitiesStore';
import type { Bim3DEntities } from '../../stores/Bim3DEntitiesStore';

type Wall = Bim3DEntities['walls'][number];
type Column = Bim3DEntities['columns'][number];
type Beam = Bim3DEntities['beams'][number];
type Slab = Bim3DEntities['slabs'][number];
type Stair = Bim3DEntities['stairs'][number];
type SlabOpening = Bim3DEntities['slabOpenings'][number];
type Opening = Bim3DEntities['openings'][number];

/** A non-degenerate triangle footprint (≥3 verts) for member geometry reads. */
const TRI = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }] as const;

/** Spread an optional `layerId` only when provided (the V/G-only tests run layer-less). */
function withLayer(layerId?: string): { layerId?: string } {
  return layerId ? { layerId } : {};
}

/** Straight wall — `syncWalls` reads `params.start`/`params.end` + `kind` unconditionally. */
export function minimalWall(id: string, layerId?: string): Wall {
  return { id, ...withLayer(layerId), kind: 'straight', params: { start: { x: 0, y: 0 }, end: { x: 1, y: 0 } } } as unknown as Wall;
}

/** Column — `syncColumns` only needs a non-undefined `params` (resolvers are field-defensive). */
export function minimalColumn(id: string, layerId?: string): Column {
  return { id, ...withLayer(layerId), params: {} } as unknown as Column;
}

/** Beam — `syncBeams` reads `params.topElevation`/`params.depth` + `geometry.outline.vertices`. */
export function minimalBeam(id: string, layerId?: string): Beam {
  return { id, ...withLayer(layerId), params: { topElevation: 0, depth: 300 }, geometry: { outline: { vertices: [...TRI] } } } as unknown as Beam;
}

/** Slab — `buildCeilingSlabHosts` reads `params.kind` (undefined ⇒ not a ceiling host, no crash). */
export function minimalSlab(id: string, layerId?: string): Slab {
  return { id, ...withLayer(layerId), params: {} } as unknown as Slab;
}

/** Stair — `syncStairs` reads `params` optional-chained; empty object is enough. */
export function minimalStair(id: string, layerId?: string): Stair {
  return { id, ...withLayer(layerId), params: {} } as unknown as Stair;
}

/**
 * Slab opening — `slabOpeningPickMesh` reads `params.outline.vertices`; an empty outline hits the
 * `< 3` degenerate guard (no pick mesh) so the host slab's `slabToMesh` call stays the assertion
 * target. The pick-mesh geometry is exercised by its own dedicated converter tests.
 */
export function minimalSlabOpening(id: string, slabId: string, layerId?: string): SlabOpening {
  return { id, ...withLayer(layerId), params: { slabId, outline: { vertices: [] } } } as unknown as SlabOpening;
}

/** Hosted opening — passed straight to the mocked `wallToMesh`; only the host link is read. */
export function minimalOpening(id: string, wallId: string, layerId?: string): Opening {
  return { id, ...withLayer(layerId), params: { wallId } } as unknown as Opening;
}

/**
 * One realistic entity of every populated category (ids `w1`/`c1`/`b1`/`s1`/`so1`/`o1`/`st1`,
 * matching the existing suites). `layerIds: true` tags each with its canonical V/G layer id
 * (`walls-layer`, `cols-layer`, …) for the Layer-source visibility tests; omitted ⇒ layer-less
 * (the V/G-only suite must not trigger the real `getLayer` lookup).
 */
export function makeMinimalBimEntities(opts: { layerIds?: boolean } = {}): Bim3DEntities {
  const li = opts.layerIds ?? false;
  return {
    ...EMPTY_BIM_ENTITIES,
    walls:        [minimalWall('w1', li ? 'walls-layer' : undefined)],
    columns:      [minimalColumn('c1', li ? 'cols-layer' : undefined)],
    beams:        [minimalBeam('b1', li ? 'beams-layer' : undefined)],
    slabs:        [minimalSlab('s1', li ? 'slabs-layer' : undefined)],
    slabOpenings: [minimalSlabOpening('so1', 's1', li ? 'so-layer' : undefined)],
    openings:     [minimalOpening('o1', 'w1', li ? 'op-layer' : undefined)],
    stairs:       [minimalStair('st1', li ? 'stairs-layer' : undefined)],
  };
}

/** A floor with exactly one wall (other categories empty) for precise per-floor mesh counting. */
export function makeMinimalWallFloor(wallId: string): Bim3DEntities {
  return { ...EMPTY_BIM_ENTITIES, walls: [minimalWall(wallId)] };
}
