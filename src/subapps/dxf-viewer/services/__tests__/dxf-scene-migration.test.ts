/**
 * ADR-358 Phase 14 — `migrateSceneLayerV1ToV2` + `migrateLayersById` unit tests.
 *
 * Verifies:
 *   - V1 (4-field) layer gets all ADR-358 defaults applied correctly.
 *   - Already-migrated (full) layers pass through unchanged (idempotent).
 *   - `id` fallback to map key when layer.id absent.
 *   - `name` fallback to map key when layer.name absent.
 *   - `source` defaults to 'dxf-import'.
 *   - Partial layers (some fields set) preserve provided values.
 *   - `migrateLayersById` processes every entry in the map.
 *   - Integration: `parseAndValidateScene` triggers migration automatically.
 */

import { describe, it, expect } from '@jest/globals';
import { migrateSceneLayerV1ToV2, migrateLayersById } from '../dxf-scene-migration';
import { parseAndValidateScene } from '../dxf-scene-json';

// ─── migrateSceneLayerV1ToV2 ────────────────────────────────────────────────

describe('migrateSceneLayerV1ToV2 — V1 minimal (4 fields)', () => {
  it('applies all ADR-358 defaults to a V1 layer', () => {
    const result = migrateSceneLayerV1ToV2('WALLS', {
      name: 'WALLS',
      color: '#ff0000',
      visible: true,
      locked: false,
    });

    expect(result.id).toBe('WALLS');
    expect(result.name).toBe('WALLS');
    expect(result.color).toBe('#ff0000');
    expect(result.visible).toBe(true);
    expect(result.locked).toBe(false);
    expect(result.linetype).toBe('Continuous');
    expect(result.lineweight).toBe(-3);
    expect(result.transparency).toBe(0);
    expect(result.frozen).toBe(false);
    expect(result.plottable).toBe(true);
    expect(result.source).toBe('dxf-import');
  });

  it('uses mapKey as id when layer.id absent', () => {
    const result = migrateSceneLayerV1ToV2('0', { name: '0', color: '#fff', visible: true, locked: false });
    expect(result.id).toBe('0');
  });

  it('uses mapKey as id when layer.id is empty string', () => {
    const result = migrateSceneLayerV1ToV2('DIMS', { name: 'DIMS', color: '#fff', visible: true, locked: false, id: '' });
    expect(result.id).toBe('DIMS');
  });

  it('uses mapKey as name when layer.name absent', () => {
    const result = migrateSceneLayerV1ToV2('HIDDEN', { color: '#000', visible: false, locked: false });
    expect(result.name).toBe('HIDDEN');
    expect(result.id).toBe('HIDDEN');
  });

  it('defaults color to #ffffff when absent', () => {
    const result = migrateSceneLayerV1ToV2('X', { name: 'X', visible: true, locked: false });
    expect(result.color).toBe('#ffffff');
  });

  it('defaults visible to true when absent', () => {
    const result = migrateSceneLayerV1ToV2('X', { name: 'X', color: '#000', locked: false });
    expect(result.visible).toBe(true);
  });

  it('defaults locked to false when absent', () => {
    const result = migrateSceneLayerV1ToV2('X', { name: 'X', color: '#000', visible: true });
    expect(result.locked).toBe(false);
  });

  it('defaults source to dxf-import when absent', () => {
    const result = migrateSceneLayerV1ToV2('X', { name: 'X', color: '#000', visible: true, locked: false });
    expect(result.source).toBe('dxf-import');
  });
});

describe('migrateSceneLayerV1ToV2 — partial layers (some ADR-358 fields set)', () => {
  it('preserves user-set linetype', () => {
    const result = migrateSceneLayerV1ToV2('DASH', {
      name: 'DASH',
      color: '#000',
      visible: true,
      locked: false,
      linetype: 'Dashed',
    });
    expect(result.linetype).toBe('Dashed');
  });

  it('preserves user-set lineweight', () => {
    const result = migrateSceneLayerV1ToV2('HEAVY', {
      name: 'HEAVY',
      color: '#000',
      visible: true,
      locked: false,
      lineweight: 0.5,
    });
    expect(result.lineweight).toBe(0.5);
  });

  it('preserves user-set transparency', () => {
    const result = migrateSceneLayerV1ToV2('FADE', {
      name: 'FADE',
      color: '#000',
      visible: true,
      locked: false,
      transparency: 50,
    });
    expect(result.transparency).toBe(50);
  });

  it('preserves user-set frozen=true', () => {
    const result = migrateSceneLayerV1ToV2('FROZEN', {
      name: 'FROZEN',
      color: '#000',
      visible: true,
      locked: false,
      frozen: true,
    });
    expect(result.frozen).toBe(true);
  });

  it('preserves user-set plottable=false', () => {
    const result = migrateSceneLayerV1ToV2('NOPLOT', {
      name: 'NOPLOT',
      color: '#000',
      visible: true,
      locked: false,
      plottable: false,
    });
    expect(result.plottable).toBe(false);
  });

  it('preserves user-set source=user-created', () => {
    const result = migrateSceneLayerV1ToV2('USR', {
      name: 'USR',
      color: '#000',
      visible: true,
      locked: false,
      source: 'user-created',
    });
    expect(result.source).toBe('user-created');
  });

  it('preserves existing lyr_ enterprise id', () => {
    const result = migrateSceneLayerV1ToV2('WALLS', {
      name: 'WALLS',
      color: '#000',
      visible: true,
      locked: false,
      id: 'lyr_existing',
      linetype: 'Continuous',
      lineweight: -3 as const,
      transparency: 0,
      frozen: false,
      plottable: true,
      source: 'dxf-import',
    });
    expect(result.id).toBe('lyr_existing');
  });
});

describe('migrateSceneLayerV1ToV2 — idempotent (already-migrated layer)', () => {
  it('passes through a fully-migrated layer unchanged', () => {
    const full = {
      id: 'lyr_abc123',
      name: 'A-WALL',
      color: '#ff0000',
      visible: true,
      locked: false,
      linetype: 'Dashed',
      lineweight: 0.5 as const,
      transparency: 20,
      frozen: true,
      plottable: false,
      source: 'dxf-import' as const,
    };
    const result = migrateSceneLayerV1ToV2('A-WALL', full);
    expect(result.id).toBe('lyr_abc123');
    expect(result.linetype).toBe('Dashed');
    expect(result.lineweight).toBe(0.5);
    expect(result.transparency).toBe(20);
    expect(result.frozen).toBe(true);
    expect(result.plottable).toBe(false);
  });
});

// ─── migrateLayersById ──────────────────────────────────────────────────────

describe('migrateLayersById', () => {
  it('migrates every entry in the map', () => {
    const raw = {
      WALLS: { name: 'WALLS', color: '#f00', visible: true, locked: false },
      DIMS:  { name: 'DIMS',  color: '#0f0', visible: false, locked: true },
    };
    const result = migrateLayersById(raw as Record<string, never>);
    expect(Object.keys(result)).toEqual(['WALLS', 'DIMS']);
    expect(result.WALLS.id).toBe('WALLS');
    expect(result.DIMS.id).toBe('DIMS');
    expect(result.WALLS.linetype).toBe('Continuous');
    expect(result.DIMS.plottable).toBe(true);
  });

  it('returns empty map for empty input', () => {
    expect(migrateLayersById({})).toEqual({});
  });

  it('preserves map keys (= layer name slug)', () => {
    const raw = { '0': { name: '0', color: '#fff', visible: true, locked: false } };
    const result = migrateLayersById(raw as Record<string, never>);
    expect(result['0']).toBeDefined();
    expect(result['0'].id).toBe('0');
  });
});

// ─── parseAndValidateScene integration (Phase 14 wiring) ────────────────────

describe('parseAndValidateScene — Phase 14 migration integration', () => {
  it('migrates V1 layers (name-keyed `layers`) on parse', () => {
    const v1Scene = {
      entities: [{ id: 'ent_1', type: 'line', layerId: 'WALLS' }],
      layers: {
        WALLS: { name: 'WALLS', color: '#ff0000', visible: true, locked: false },
      },
      bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 },
      units: 'mm',
    };
    const result = parseAndValidateScene(JSON.stringify(v1Scene));
    expect(result).not.toBeNull();
    const wall = result!.layersById['WALLS'];
    expect(wall).toBeDefined();
    expect(wall.id).toBe('WALLS');
    expect(wall.linetype).toBe('Continuous');
    expect(wall.lineweight).toBe(-3);
    expect(wall.transparency).toBe(0);
    expect(wall.frozen).toBe(false);
    expect(wall.plottable).toBe(true);
    expect(wall.source).toBe('dxf-import');
  });

  it('migrates V1 layers in `layersById` (no id field)', () => {
    const v1Scene = {
      entities: [{ id: 'ent_1', type: 'line', layerId: 'DIMS' }],
      layersById: {
        DIMS: { name: 'DIMS', color: '#00ff00', visible: false, locked: false },
      },
      bounds: { minX: 0, minY: 0, maxX: 1, maxY: 1 },
      units: 'mm',
    };
    const result = parseAndValidateScene(JSON.stringify(v1Scene));
    expect(result).not.toBeNull();
    expect(result!.layersById['DIMS'].id).toBe('DIMS');
    expect(result!.layersById['DIMS'].linetype).toBe('Continuous');
  });

  it('already-migrated scenes parse without modification', () => {
    const v2Scene = {
      entities: [{ id: 'ent_1', type: 'line', layerId: 'lyr_abc' }],
      layersById: {
        lyr_abc: {
          id: 'lyr_abc',
          name: 'A-WALL',
          color: '#ff0000',
          visible: true,
          locked: false,
          linetype: 'Dashed',
          lineweight: 0.5,
          transparency: 10,
          frozen: false,
          plottable: true,
          source: 'dxf-import',
        },
      },
      bounds: { minX: 0, minY: 0, maxX: 1, maxY: 1 },
      units: 'mm',
    };
    const result = parseAndValidateScene(JSON.stringify(v2Scene));
    expect(result).not.toBeNull();
    const layer = result!.layersById['lyr_abc'];
    expect(layer.id).toBe('lyr_abc');
    expect(layer.linetype).toBe('Dashed');
    expect(layer.lineweight).toBe(0.5);
  });
});
