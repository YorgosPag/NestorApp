/**
 * DXF Layer Round-trip Integrity — ADR-358 §G15 Phase 3C.
 *
 * Five-fixture suite proving `writeLayerTable() → parseLinetypeTable() +
 * parseLayerTable()` reconstructs the original `SceneLayer[]` byte-equivalent.
 *
 * Fixtures:
 *   1. ISO baseline linetype, minimal — defaults only.
 *   2. Custom linetype, all 11 DXF layer fields populated.
 *   3. All Nestor XDATA (description + AEC category + tags).
 *   4. Null / default variants — confirms defaults round-trip cleanly.
 *   5. Q15 bimCategory + Q16 vpOverrides scaffold round-trip.
 *
 * Plus: `LinetypeRegistry` snapshot stability — custom DXF-imported linetypes
 * survive the round trip alongside the ISO baseline.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  __resetLinetypeRegistryForTesting,
  registerLinetypes,
  listLinetypes,
} from '../../stores/LinetypeRegistry';
import { LINETYPE_ISO_NAMES, type LinetypeDef } from '../../config/linetype-iso-catalog';
import { createSceneLayer, type SceneLayer } from '../../types/entities';
import { parseLinetypeTable } from '../dxf-linetype-table-parser';
import { parseLayerTable } from '../dxf-layer-table-parser';
import { writeLayerTable } from '../dxf-layer-table-writer';
import { getAciColor } from '../../settings/standards/aci';

beforeEach(() => {
  __resetLinetypeRegistryForTesting();
});

/** Round-trip a layer set through write → parse, returning the recovered layers. */
function roundTrip(
  layers: ReadonlyArray<SceneLayer>,
  customLinetypes: ReadonlyArray<LinetypeDef> = [],
): { recovered: ReadonlyArray<SceneLayer>; recoveredLinetypes: ReadonlyArray<LinetypeDef> } {
  if (customLinetypes.length > 0) registerLinetypes(customLinetypes);
  const tokens = writeLayerTable({ layers, customLinetypes });

  __resetLinetypeRegistryForTesting();
  const lt = parseLinetypeTable(tokens);
  registerLinetypes(lt.linetypes);
  const result = parseLayerTable(tokens);

  return { recovered: result.layers, recoveredLinetypes: lt.linetypes };
}

describe('DXF layer round-trip — fixture 1: ISO baseline, minimal', () => {
  it('round-trips a single ACI-7 / Continuous layer with all defaults', () => {
    const original = [
      createSceneLayer({
        name: 'L1',
        color: getAciColor(7),
        colorAci: 7,
        source: 'dxf-import',
      }),
    ];

    const { recovered } = roundTrip(original);
    expect(recovered).toEqual(original);
  });
});

describe('DXF layer round-trip — fixture 2: custom linetype, all 11 fields', () => {
  it('preserves every DXF field plus custom linetype reference', () => {
    const customLt: LinetypeDef = {
      name: 'WallDashed',
      description: '__ . __',
      pattern: [12, -3, 0, -3],
      origin: 'dxf-import',
    };

    const original = [
      createSceneLayer({
        name: 'A-WALL',
        color: '#FF8040',
        colorAci: 1,
        colorTrueColor: 0xff8040,
        linetype: 'WallDashed',
        lineweight: 0.5,
        transparency: 30,
        visible: true,
        frozen: false,
        locked: false,
        plottable: true,
        description: 'Architectural walls — load-bearing',
        category: 'architectural',
        tags: ['load-bearing', 'fire-rated'],
        source: 'dxf-import',
      }),
    ];

    const { recovered, recoveredLinetypes } = roundTrip(original, [customLt]);

    expect(recovered).toHaveLength(1);
    expect(recovered[0].name).toBe('A-WALL');
    expect(recovered[0].colorAci).toBe(1);
    expect(recovered[0].colorTrueColor).toBe(0xff8040);
    expect(recovered[0].linetype).toBe('WallDashed');
    expect(recovered[0].lineweight).toBe(0.5);
    expect(recovered[0].transparency).toBe(30);
    expect(recovered[0].plottable).toBe(true);
    expect(recovered[0].description).toBe('Architectural walls — load-bearing');
    expect(recovered[0].category).toBe('architectural');
    expect(recovered[0].tags).toEqual(['load-bearing', 'fire-rated']);
    expect(recovered).toEqual(original);

    expect(recoveredLinetypes.map((l) => l.name)).toContain('WallDashed');
  });
});

describe('DXF layer round-trip — fixture 3: all Nestor XDATA populated', () => {
  it('AEC category + tags + description survive XDATA round trip', () => {
    const original = [
      createSceneLayer({
        name: 'E-LITE',
        color: getAciColor(4),
        colorAci: 4,
        source: 'dxf-import',
        category: 'electrical',
        tags: ['lighting', 'general-power'],
        description: 'Lighting and general-purpose receptacles',
      }),
    ];

    const { recovered } = roundTrip(original);
    expect(recovered).toEqual(original);
  });
});

describe('DXF layer round-trip — fixture 4: null / default variants', () => {
  it('layer with frozen + locked + invisible + plottable=false round-trips', () => {
    const original = [
      createSceneLayer({
        name: 'HIDDEN_LOCKED',
        color: getAciColor(8),
        colorAci: 8,
        visible: false,
        frozen: true,
        locked: true,
        plottable: false,
        source: 'dxf-import',
      }),
    ];

    const { recovered } = roundTrip(original);
    expect(recovered).toEqual(original);
  });

  it('layer with no truecolor (null) round-trips without inventing one', () => {
    const original = [
      createSceneLayer({
        name: 'NoTC',
        color: getAciColor(5),
        colorAci: 5,
        colorTrueColor: null,
        source: 'dxf-import',
      }),
    ];

    const { recovered } = roundTrip(original);
    expect(recovered[0].colorTrueColor).toBeNull();
    expect(recovered).toEqual(original);
  });
});

describe('DXF layer round-trip — fixture 5: Q15 + Q16 scaffold preservation', () => {
  it('bimCategory (Q15) survives XDATA NestorBimCategory round trip', () => {
    const original = [
      createSceneLayer({
        name: 'S-COL',
        color: getAciColor(2),
        colorAci: 2,
        source: 'dxf-import',
        category: 'structural',
        bimCategory: 'IfcColumn',
      }),
    ];

    const { recovered } = roundTrip(original);
    expect(recovered[0].bimCategory).toBe('IfcColumn');
    expect(recovered).toEqual(original);
  });

  it('vpOverrides (Q16) survives XDATA NestorVpOverride JSON round trip', () => {
    const overrides = {
      vp_floor1: { visible: false, frozen: true },
      vp_floor2: { colorAci: 6, lineweight: 0.13 },
    };
    const original = [
      createSceneLayer({
        name: 'M-HVAC',
        color: getAciColor(3),
        colorAci: 3,
        source: 'dxf-import',
        category: 'mechanical',
        vpOverrides: overrides,
      }),
    ];

    const { recovered } = roundTrip(original);
    expect(recovered[0].vpOverrides).toEqual(overrides);
    expect(recovered).toEqual(original);
  });
});

describe('DXF layer round-trip — full 5-layer scene', () => {
  it('round-trips all five fixtures together byte-equivalent + linetype registry stable', () => {
    const customLt: LinetypeDef = {
      name: 'WallDashed',
      description: '__ . __',
      pattern: [12, -3, 0, -3],
      origin: 'dxf-import',
    };

    const original = [
      createSceneLayer({
        name: 'L1', color: getAciColor(7), colorAci: 7, source: 'dxf-import',
      }),
      createSceneLayer({
        name: 'A-WALL', color: '#FF8040', colorAci: 1, colorTrueColor: 0xff8040,
        linetype: 'WallDashed', lineweight: 0.5, transparency: 30,
        description: 'walls', category: 'architectural', tags: ['load-bearing'],
        source: 'dxf-import',
      }),
      createSceneLayer({
        name: 'HIDDEN_LOCKED', color: getAciColor(8), colorAci: 8,
        visible: false, frozen: true, locked: true, plottable: false,
        source: 'dxf-import',
      }),
      createSceneLayer({
        name: 'S-COL', color: getAciColor(2), colorAci: 2, source: 'dxf-import',
        category: 'structural', bimCategory: 'IfcColumn',
      }),
      createSceneLayer({
        name: 'M-HVAC', color: getAciColor(3), colorAci: 3, source: 'dxf-import',
        category: 'mechanical',
        vpOverrides: { vp_a: { visible: false } },
      }),
    ];

    const { recovered, recoveredLinetypes } = roundTrip(original, [customLt]);
    expect(recovered).toEqual(original);

    // LinetypeRegistry stable: custom linetype recovered post-round-trip
    expect(recoveredLinetypes.map((l) => l.name)).toContain('WallDashed');

    // ISO baseline names accessible after re-registering through fresh registry seed
    const liveSnap = listLinetypes().map((l) => l.name);
    for (const iso of LINETYPE_ISO_NAMES) {
      expect(liveSnap).toContain(iso);
    }
  });
});
