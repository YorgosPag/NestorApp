/**
 * ADR-358 Phase 15 — Layer round-trip integration: V1 migration + DXF export/import.
 *
 * Tests that a pre-ADR-358 Firestore scene (V1 layers, 4 fields only) can:
 *   1. Be loaded via `parseAndValidateScene` (Phase 14 migration fires automatically).
 *   2. Have its migrated layers exported to DXF tokens via `writeLayerTable`.
 *   3. Be re-imported via `parseLayerTable` with ALL visual properties preserved.
 *
 * ID note: the DXF NestorLayerId XDATA parser only restores ids with `lyr_` prefix
 * (ADR-358 Phase 9C enterprise-id contract). Name-slug ids ('WALLS', 'LOCKED') are
 * intentionally replaced with a fresh lyr_ UUID on first DXF export/import — this
 * is correct: it upgrades the legacy layer to a proper enterprise id. The tests
 * below verify VISUAL properties (name, color, linetype, lineweight, etc.), not the
 * ephemeral name-slug id.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { parseAndValidateScene } from '../dxf-scene-json';
import { writeLayerTable } from '../../utils/dxf-layer-table-writer';
import { parseLayerTable } from '../../utils/dxf-layer-table-parser';
import { parseLinetypeTable } from '../../utils/dxf-linetype-table-parser';
import {
  __resetLinetypeRegistryForTesting,
  registerLinetypes,
} from '../../stores/LinetypeRegistry';
import { getAciColor } from '../../settings/standards/aci';
import { createSceneLayer, type SceneLayer } from '../../types/entities';

beforeEach(() => {
  __resetLinetypeRegistryForTesting();
});

/** Write → parse round-trip helper. Returns parsed layers. */
function roundTripLayers(layers: ReadonlyArray<SceneLayer>): ReadonlyArray<SceneLayer> {
  const tokens = writeLayerTable({ layers, customLinetypes: [] });
  __resetLinetypeRegistryForTesting();
  const lt = parseLinetypeTable(tokens);
  registerLinetypes(lt.linetypes);
  return parseLayerTable(tokens).layers;
}

/** Visual properties to check after roundtrip (id excluded — name-slug → lyr_ upgrade). */
function visualProps(l: SceneLayer) {
  return {
    name: l.name,
    color: l.color,
    colorAci: l.colorAci,
    colorTrueColor: l.colorTrueColor,
    visible: l.visible,
    locked: l.locked,
    linetype: l.linetype,
    lineweight: l.lineweight,
    transparency: l.transparency,
    frozen: l.frozen,
    plottable: l.plottable,
    source: l.source,
  };
}

// ─── Fixture 1: single V1 (4-field) layer ───────────────────────────────────

describe('Phase 15 round-trip — Fixture 1: single V1 layer via parseAndValidateScene', () => {
  it('migrated layer visual properties survive DXF write → parse round-trip', () => {
    const v1Scene = JSON.stringify({
      entities: [{ id: 'ent_1', type: 'line', layerId: 'WALLS' }],
      layers: {
        WALLS: { name: 'WALLS', color: getAciColor(7), colorAci: 7, visible: true, locked: false },
      },
      bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 },
      units: 'mm',
    });

    const scene = parseAndValidateScene(v1Scene);
    expect(scene).not.toBeNull();

    const migratedLayer = scene!.layersById['WALLS'];
    expect(migratedLayer.id).toBe('WALLS');
    expect(migratedLayer.linetype).toBe('Continuous');
    expect(migratedLayer.lineweight).toBe(-3);
    expect(migratedLayer.source).toBe('dxf-import');

    const recovered = roundTripLayers([migratedLayer]);
    expect(recovered).toHaveLength(1);

    // Visual properties preserved
    expect(visualProps(recovered[0])).toEqual(visualProps(migratedLayer));

    // id upgraded from name-slug 'WALLS' → proper lyr_ enterprise id
    expect(recovered[0].id).toMatch(/^lyr_/);
    expect(recovered[0].id).not.toBe('WALLS');
  });
});

// ─── Fixture 2: multi-layer V1 scene ────────────────────────────────────────

describe('Phase 15 round-trip — Fixture 2: multi-layer V1 scene', () => {
  it('all V1 layers have defaults after migration', () => {
    const v1Scene = JSON.stringify({
      entities: [{ id: 'ent_1', type: 'line', layerId: 'WALLS' }],
      layers: {
        WALLS:  { name: 'WALLS',  color: getAciColor(1), colorAci: 1, visible: true,  locked: false },
        DIMS:   { name: 'DIMS',   color: getAciColor(3), colorAci: 3, visible: true,  locked: false },
        HIDDEN: { name: 'HIDDEN', color: getAciColor(8), colorAci: 8, visible: false, locked: true  },
      },
      bounds: { minX: 0, minY: 0, maxX: 1, maxY: 1 },
      units: 'mm',
    });

    const scene = parseAndValidateScene(v1Scene);
    expect(scene).not.toBeNull();

    const layers = Object.values(scene!.layersById);
    expect(layers).toHaveLength(3);

    layers.forEach((l) => {
      expect(l.linetype).toBe('Continuous');
      expect(l.lineweight).toBe(-3);
      expect(l.transparency).toBe(0);
      expect(l.frozen).toBe(false);
      expect(l.plottable).toBe(true);
      expect(l.source).toBe('dxf-import');
    });
  });

  it('all V1 layers visual props survive DXF write → parse round-trip', () => {
    const v1Scene = JSON.stringify({
      entities: [{ id: 'ent_1', type: 'line', layerId: 'WALLS' }],
      layers: {
        WALLS:  { name: 'WALLS',  color: getAciColor(1), colorAci: 1, visible: true,  locked: false },
        DIMS:   { name: 'DIMS',   color: getAciColor(3), colorAci: 3, visible: true,  locked: false },
        HIDDEN: { name: 'HIDDEN', color: getAciColor(8), colorAci: 8, visible: false, locked: true  },
      },
      bounds: { minX: 0, minY: 0, maxX: 1, maxY: 1 },
      units: 'mm',
    });

    const scene = parseAndValidateScene(v1Scene);
    const layers = Object.values(scene!.layersById);
    const recovered = roundTripLayers(layers);

    expect(recovered).toHaveLength(3);
    const names = recovered.map((l) => l.name).sort();
    expect(names).toEqual(['DIMS', 'HIDDEN', 'WALLS']);

    recovered.forEach((r) => {
      const original = layers.find((l) => l.name === r.name)!;
      expect(visualProps(r)).toEqual(visualProps(original));
      // Name-slug ids upgraded to enterprise ids on first DXF roundtrip
      expect(r.id).toMatch(/^lyr_/);
    });
  });
});

// ─── Fixture 3: already-migrated V2 scene with full enterprise id ────────────

describe('Phase 15 round-trip — Fixture 3: V2 layer with lyr_ id → full byte-identical roundtrip', () => {
  it('V2 layer with lyr_ id passes through parseAndValidateScene + roundtrip unchanged', () => {
    // Use createSceneLayer to get the full canonical object (all optional fields set)
    const v2Layer = createSceneLayer({
      id: 'lyr_test123',
      name: 'A-WALL',
      color: getAciColor(2),
      colorAci: 2,
      colorTrueColor: null,
      visible: true,
      locked: false,
      linetype: 'Continuous',
      lineweight: 0.35,
      transparency: 0,
      frozen: false,
      plottable: true,
      source: 'dxf-import',
      category: 'architectural',
    });

    const v2Scene = JSON.stringify({
      entities: [{ id: 'ent_1', type: 'line', layerId: 'lyr_test123' }],
      layersById: { lyr_test123: v2Layer },
      bounds: { minX: 0, minY: 0, maxX: 1, maxY: 1 },
      units: 'mm',
    });

    const scene = parseAndValidateScene(v2Scene);
    expect(scene).not.toBeNull();

    const layer = scene!.layersById['lyr_test123'];
    expect(layer.id).toBe('lyr_test123');
    expect(layer.lineweight).toBe(0.35);
    expect(layer.category).toBe('architectural');

    const recovered = roundTripLayers([layer]);
    // Enterprise id preserved (lyr_ prefix respected by NestorLayerId parser)
    expect(recovered[0].id).toBe('lyr_test123');
    expect(recovered[0]).toEqual(layer);
  });
});

// ─── Fixture 4: V1 visible=false + locked=true round-trip ───────────────────

describe('Phase 15 round-trip — Fixture 4: V1 off+locked layer', () => {
  it('visible=false locked=true survive migration + roundtrip visual props', () => {
    const v1Scene = JSON.stringify({
      entities: [{ id: 'ent_1', type: 'line', layerId: 'LOCKED' }],
      layers: {
        LOCKED: { name: 'LOCKED', color: getAciColor(9), colorAci: 9, visible: false, locked: true },
      },
      bounds: { minX: 0, minY: 0, maxX: 1, maxY: 1 },
      units: 'mm',
    });

    const scene = parseAndValidateScene(v1Scene);
    const layer = scene!.layersById['LOCKED'];
    expect(layer.visible).toBe(false);
    expect(layer.locked).toBe(true);

    const recovered = roundTripLayers([layer]);
    expect(recovered[0].visible).toBe(false);
    expect(recovered[0].locked).toBe(true);
    expect(recovered[0].name).toBe('LOCKED');
    expect(recovered[0].source).toBe('dxf-import');
    expect(visualProps(recovered[0])).toEqual(visualProps(layer));
  });
});
