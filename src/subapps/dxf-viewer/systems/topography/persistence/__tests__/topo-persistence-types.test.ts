/**
 * ADR-650 — topo persistence (de)serialization contract tests.
 */

import {
  TOPO_INLINE_MAX_BYTES,
  docToTopoState,
  isEmptyTopoState,
  topoDefinitionByteSize,
  topoSettingsDocFields,
  topoStateSignature,
  withSurfaces,
  type TopoPersistedState,
  type TopoSurfaceDoc,
} from '../topo-persistence-types';
import type { TopoSurfacesDefinition } from '../topo-persistence-types';

const EMPTY_DEF = { points: [], breaklines: [] } as const;

function baseState(overrides: Partial<TopoPersistedState> = {}): TopoPersistedState {
  return {
    surfaces: { existing: EMPTY_DEF, proposed: EMPTY_DEF },
    boundary: null,
    contourConfig: { intervalMm: 500, majorEvery: 5, baseElevationMm: 0, labelMajors: true, labelDecimals: 2 },
    contourDisplayStyle: 'exact',
    terrain3d: { visible: false, style: 'shaded' },
    cutFill: { mode: 'datum', datumZMm: 0 },
    ...overrides,
  };
}

const surveyed: TopoSurfacesDefinition = {
  existing: { points: [{ x: 1, y: 2, z: 3 }, { x: 4, y: 5, z: 6 }, { x: 7, y: 8, z: 9 }], breaklines: [] },
  proposed: EMPTY_DEF,
};

describe('topo-persistence-types', () => {
  describe('isEmptyTopoState', () => {
    it('is empty when no points and no boundary', () => {
      expect(isEmptyTopoState(baseState())).toBe(true);
    });
    it('is NOT empty once a surface has points', () => {
      expect(isEmptyTopoState(baseState({ surfaces: surveyed }))).toBe(false);
    });
    it('is NOT empty once a boundary is set (points still empty)', () => {
      expect(isEmptyTopoState(baseState({ boundary: { vertices: [{ x: 0, y: 0 }] } }))).toBe(false);
    });
  });

  describe('topoStateSignature', () => {
    it('is stable for equal states and differs on any change', () => {
      const a = baseState({ surfaces: surveyed });
      const b = baseState({ surfaces: surveyed });
      expect(topoStateSignature(a)).toBe(topoStateSignature(b));
      expect(topoStateSignature(a)).not.toBe(
        topoStateSignature(baseState({ surfaces: surveyed, contourDisplayStyle: 'smooth' })),
      );
      expect(topoStateSignature(a)).not.toBe(
        topoStateSignature(baseState({ surfaces: surveyed, cutFill: { mode: 'surface', datumZMm: 0 } })),
      );
    });
  });

  describe('topoDefinitionByteSize / inline threshold', () => {
    it('a small survey is under the inline threshold', () => {
      expect(topoDefinitionByteSize(surveyed)).toBeLessThan(TOPO_INLINE_MAX_BYTES);
    });
    it('a large synthetic cloud exceeds the inline threshold', () => {
      const cloud = Array.from({ length: 40_000 }, (_, i) => ({ x: i, y: i, z: i }));
      const big: TopoSurfacesDefinition = { existing: { points: cloud, breaklines: [] }, proposed: EMPTY_DEF };
      expect(topoDefinitionByteSize(big)).toBeGreaterThan(TOPO_INLINE_MAX_BYTES);
    });
  });

  describe('docToTopoState', () => {
    it('reads inline surfaces + settings verbatim', () => {
      const doc = {
        id: 'topo_1', companyId: 'c', projectId: 'p', floorplanId: 'f',
        surfaces: surveyed, boundary: null,
        contourConfig: { intervalMm: 1000, majorEvery: 4, baseElevationMm: 0, labelMajors: true, labelDecimals: 1 },
        contourDisplayStyle: 'smooth', terrain3d: { visible: true, style: 'hypsometric' },
        cutFill: { mode: 'surface', datumZMm: 12 }, version: 3,
      } as unknown as TopoSurfaceDoc;
      const state = docToTopoState(doc);
      expect(state.surfaces).toEqual(surveyed);
      expect(state.contourDisplayStyle).toBe('smooth');
      expect(state.terrain3d).toEqual({ visible: true, style: 'hypsometric' });
      expect(state.cutFill).toEqual({ mode: 'surface', datumZMm: 12 });
    });

    it('defaults every absent field (partial/legacy doc)', () => {
      const doc = { id: 'topo_2', companyId: 'c', projectId: 'p', floorplanId: 'f', boundary: null, version: 1 } as unknown as TopoSurfaceDoc;
      const state = docToTopoState(doc);
      expect(state.surfaces.existing.points).toEqual([]);
      expect(state.contourDisplayStyle).toBe('exact');
      expect(state.terrain3d).toEqual({ visible: false, style: 'shaded' });
      expect(state.cutFill).toEqual({ mode: 'datum', datumZMm: 0 });
    });

    it('an offloaded doc yields empty surfaces until the blob is merged via withSurfaces', () => {
      const doc = { id: 'topo_3', companyId: 'c', projectId: 'p', floorplanId: 'f', pointsStoragePath: 'topo-surfaces/c/flr_1/topo_3.json', boundary: null, version: 1 } as unknown as TopoSurfaceDoc;
      const state = docToTopoState(doc);
      expect(state.surfaces.existing.points).toEqual([]);
      const merged = withSurfaces(state, surveyed);
      expect(merged.surfaces).toEqual(surveyed);
    });
  });

  describe('topoSettingsDocFields', () => {
    it('carries every setting except the survey definition', () => {
      const fields = topoSettingsDocFields(baseState({ surfaces: surveyed, contourDisplayStyle: 'smooth' }));
      expect(fields).not.toHaveProperty('surfaces');
      expect(fields.contourDisplayStyle).toBe('smooth');
      expect(fields.cutFill).toEqual({ mode: 'datum', datumZMm: 0 });
    });
  });
});
