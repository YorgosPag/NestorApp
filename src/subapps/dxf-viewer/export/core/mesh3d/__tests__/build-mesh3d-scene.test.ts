/**
 * ADR-668 — building-gate regression lock (bug: OBJ/mesh3d marked EVERY body `HIDDEN_`).
 *
 * Root cause (handoff 2026-07-18): `ExportHost` forgot `deps.buildings`, so `resolveEntityBuilding`
 * returned undefined → `buildingId=''` → `BimSceneLayer.shouldRender('', …, activeBuildingId)` →
 * false → with `includeHidden:true` every column/wall body was recorded as hidden and exported
 * `HIDDEN_` + fully transparent. The σοβάς survived because its own bimId never passes the gate.
 *
 * Two fixes, both locked here at the exact seam `buildMesh3dScene` owns (the adapter suite mocks
 * `buildMesh3dScene`, so it can't see this):
 *   A) `ExportHost` now feeds real `deps.buildings` — asserted by "forwards deps.buildings".
 *   B) The export neutralises the transient active-building view focus by passing
 *      `activeBuildingId = null` to the layer (Revit/ArchiCAD never filter an export by focus; the
 *      `includeHidden` contract already promises the whole model) — asserted by "…passes null".
 *
 * We spy on `BimSceneLayer.prototype.syncMultiFloor` rather than exercise the ~30 real converters:
 * the target is the deps→layer wiring `buildMesh3dScene` decides, not the BIM geometry (its suites
 * own that). Headless: `BimSceneLayer` needs only `new THREE.Scene()` (same as every sibling suite).
 */

import { BimSceneLayer } from '../../../../bim-3d/scene/BimSceneLayer';
import { buildMesh3dScene } from '../build-mesh3d-scene';
import type { ResolvedExportFloor } from '../../export-floor-scope';
import type { ExportDeps } from '../../types';
import type { Level } from '../../../../systems/levels/config';
import type { BuildingRef } from '../../../../bim/utils/bim-floor-utils';

const BASE_DEPS: ExportDeps = {
  levelScenes: [],
  activeLevelId: 'lvl-1',
  projectName: 'Katoikia',
  dateStr: '2026-07-17',
};

/** One floor, empty scene — the assertion target is the syncMultiFloor call args, not the meshes. */
function makeFloor(): ResolvedExportFloor {
  return {
    level: { id: 'lvl-1', name: 'Ισόγειο', order: 0 } as Level,
    scene: { entities: [] } as unknown as ResolvedExportFloor['scene'],
    layerPrefix: '',
  };
}

let syncSpy: jest.SpyInstance;

beforeEach(() => {
  // Intercept the real stacked build (converters + joint rebar) — we only inspect the wiring.
  syncSpy = jest.spyOn(BimSceneLayer.prototype, 'syncMultiFloor').mockImplementation(() => {});
});

afterEach(() => {
  syncSpy.mockRestore();
});

describe('buildMesh3dScene — building gate (ADR-668)', () => {
  it('B: neutralises the active-building view focus — passes activeBuildingId=null to the layer', () => {
    const deps: ExportDeps = {
      ...BASE_DEPS,
      buildings: [{ id: 'bldg-x', baseElevation: 0, name: 'Κτίριο' }],
      // A real focused building would previously hide every body whose resolution failed.
      activeBuildingId: 'bldg-x',
    };

    buildMesh3dScene([makeFloor()], deps);

    expect(syncSpy).toHaveBeenCalledTimes(1);
    // syncMultiFloor(entries, floors, buildings, activeBuildingId)
    expect(syncSpy.mock.calls[0][3]).toBeNull();
  });

  it('A: forwards deps.buildings so each entity can resolve its building (baseElevation + not HIDDEN_)', () => {
    const buildings: BuildingRef[] = [{ id: 'bldg-x', baseElevation: 2.5, name: 'Κτίριο' }];
    const deps: ExportDeps = { ...BASE_DEPS, buildings, activeBuildingId: 'bldg-x' };

    buildMesh3dScene([makeFloor()], deps);

    expect(syncSpy.mock.calls[0][2]).toBe(buildings);
  });

  it('stays robust when deps.buildings is absent — empty array + null gate, never a throw', () => {
    // DXF/TEK never populate buildings; a single-floor mesh export must still build (no stacking).
    expect(() => buildMesh3dScene([makeFloor()], BASE_DEPS)).not.toThrow();

    expect(syncSpy.mock.calls[0][2]).toEqual([]);
    expect(syncSpy.mock.calls[0][3]).toBeNull();
  });
});
