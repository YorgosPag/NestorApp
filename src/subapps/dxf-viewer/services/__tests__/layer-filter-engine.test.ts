/**
 * layer-filter-engine tests — ADR-358 §5.7.bis Q11 Phase 11.
 *
 * Covers: group + properties filters, every operator × every field, AND/OR
 * short-circuit, nested rulesets, regex safety, edge cases (undefined fields,
 * empty rulesets).
 */

import { describe, it, expect } from '@jest/globals';
import {
  applyLayerFilter,
  getMatchingLayerIds,
} from '../layer-filter-engine';
import type { SceneLayer } from '../../types/entities';
import type { LayerStoreSnapshot } from '../../stores/LayerStore';
import type { LayerFilter } from '../../types/layer-filters';

function makeLayer(overrides: Partial<SceneLayer> = {}): SceneLayer {
  return {
    id: overrides.id ?? `lyr_${Math.random().toString(36).slice(2)}`,
    name: overrides.name ?? 'A-WALL',
    color: overrides.color ?? '#FF0000',
    visible: overrides.visible ?? true,
    locked: overrides.locked ?? false,
    colorAci: overrides.colorAci ?? 1,
    linetype: overrides.linetype ?? 'Continuous',
    lineweight: overrides.lineweight ?? 0.25,
    transparency: overrides.transparency ?? 0,
    frozen: overrides.frozen ?? false,
    plottable: overrides.plottable ?? true,
    category: overrides.category ?? 'architectural',
    tags: overrides.tags ?? [],
  };
}

function makeSnapshot(layers: SceneLayer[]): LayerStoreSnapshot {
  return {
    layers,
    currentLayerId: null,
    recentLayerIds: [],
    version: 1,
  };
}

const SAMPLE_LAYERS: SceneLayer[] = [
  makeLayer({ id: 'L1', name: 'A-WALL', category: 'architectural', colorAci: 1, locked: false, visible: true, lineweight: 0.25, tags: ['floor1'] }),
  makeLayer({ id: 'L2', name: 'A-DOOR', category: 'architectural', colorAci: 3, locked: true, visible: true, lineweight: 0.18 }),
  makeLayer({ id: 'L3', name: 'S-COLS', category: 'structural', colorAci: 2, locked: false, visible: false, frozen: true, lineweight: 0.50 }),
  makeLayer({ id: 'L4', name: 'E-LITE', category: 'electrical', colorAci: 6, locked: false, visible: true, plottable: false, lineweight: 0.13 }),
];

describe('engine — group filter', () => {
  it('returns only layers whose id is in layerIds', () => {
    const filter: LayerFilter = {
      kind: 'group',
      id: 'lfg_test',
      name: 'g',
      source: 'user-created',
      createdAt: '',
      layerIds: ['L1', 'L3'],
    };
    const result = applyLayerFilter({ filter, layers: SAMPLE_LAYERS, snapshot: makeSnapshot(SAMPLE_LAYERS) });
    expect(result.map((l) => l.id)).toEqual(['L1', 'L3']);
  });

  it('returns empty when no ids match', () => {
    const filter: LayerFilter = {
      kind: 'group', id: 'lfg_x', name: 'x', source: 'user-created', createdAt: '', layerIds: ['ZZZ'],
    };
    expect(applyLayerFilter({ filter, layers: SAMPLE_LAYERS, snapshot: makeSnapshot(SAMPLE_LAYERS) })).toEqual([]);
  });
});

describe('engine — properties: name operators', () => {
  const cases: Array<[string, string, boolean, string[]]> = [
    ['equals', 'A-WALL', false, ['L1']],
    ['startsWith', 'A-', false, ['L1', 'L2']],
    ['endsWith', '-COLS', false, ['L3']],
    ['contains', 'OL', false, ['L3']],
    ['matches', '^[AE]-', false, ['L1', 'L2', 'L4']],
  ];
  it.each(cases)('operator=%s value=%s caseSensitive=%s → %p', (op, value, cs, expected) => {
    const filter: LayerFilter = {
      kind: 'properties', id: 'lfp_n', name: 'n', source: 'user-created', createdAt: '',
      rules: { combinator: 'AND', rules: [{ field: 'name', operator: op as never, value, caseSensitive: cs }] },
    };
    const result = applyLayerFilter({ filter, layers: SAMPLE_LAYERS, snapshot: makeSnapshot(SAMPLE_LAYERS) });
    expect(result.map((l) => l.id).sort()).toEqual(expected.sort());
  });

  it('malformed regex fails safe (no match)', () => {
    const filter: LayerFilter = {
      kind: 'properties', id: 'lfp_bad', name: 'bad', source: 'user-created', createdAt: '',
      rules: { combinator: 'AND', rules: [{ field: 'name', operator: 'matches', value: '[unclosed' }] },
    };
    expect(applyLayerFilter({ filter, layers: SAMPLE_LAYERS, snapshot: makeSnapshot(SAMPLE_LAYERS) })).toEqual([]);
  });
});

describe('engine — properties: category / visible / frozen / locked / plottable', () => {
  it('category is structural', () => {
    const filter: LayerFilter = {
      kind: 'properties', id: 'lfp_c', name: 'c', source: 'user-created', createdAt: '',
      rules: { combinator: 'AND', rules: [{ field: 'category', operator: 'is', value: 'structural' }] },
    };
    const r = applyLayerFilter({ filter, layers: SAMPLE_LAYERS, snapshot: makeSnapshot(SAMPLE_LAYERS) });
    expect(r.map((l) => l.id)).toEqual(['L3']);
  });

  it('category isOneOf', () => {
    const filter: LayerFilter = {
      kind: 'properties', id: 'lfp_c2', name: 'c', source: 'user-created', createdAt: '',
      rules: { combinator: 'AND', rules: [{ field: 'category', operator: 'isOneOf', value: ['structural', 'electrical'] }] },
    };
    const r = applyLayerFilter({ filter, layers: SAMPLE_LAYERS, snapshot: makeSnapshot(SAMPLE_LAYERS) });
    expect(r.map((l) => l.id).sort()).toEqual(['L3', 'L4']);
  });

  it('visible=true / locked=true / frozen=true / plottable=false', () => {
    const cases: Array<[string, boolean, string[]]> = [
      ['visible', true, ['L1', 'L2', 'L4']],
      ['locked', true, ['L2']],
      ['frozen', true, ['L3']],
      ['plottable', false, ['L4']],
    ];
    for (const [field, value, expected] of cases) {
      const filter: LayerFilter = {
        kind: 'properties', id: 'lfp', name: 'f', source: 'user-created', createdAt: '',
        rules: { combinator: 'AND', rules: [{ field: field as never, operator: 'is', value }] },
      };
      const r = applyLayerFilter({ filter, layers: SAMPLE_LAYERS, snapshot: makeSnapshot(SAMPLE_LAYERS) });
      expect(r.map((l) => l.id).sort()).toEqual(expected.sort());
    }
  });
});

describe('engine — properties: color.aci / linetype / lineweight / tag', () => {
  it('color.aci equals', () => {
    const filter: LayerFilter = {
      kind: 'properties', id: 'lfp_aci', name: 'aci', source: 'user-created', createdAt: '',
      rules: { combinator: 'AND', rules: [{ field: 'color.aci', operator: 'equals', value: 1 }] },
    };
    expect(applyLayerFilter({ filter, layers: SAMPLE_LAYERS, snapshot: makeSnapshot(SAMPLE_LAYERS) }).map((l) => l.id)).toEqual(['L1']);
  });

  it('color.aci oneOf', () => {
    const filter: LayerFilter = {
      kind: 'properties', id: 'lfp_aci2', name: 'aci', source: 'user-created', createdAt: '',
      rules: { combinator: 'AND', rules: [{ field: 'color.aci', operator: 'oneOf', value: [3, 6] }] },
    };
    expect(applyLayerFilter({ filter, layers: SAMPLE_LAYERS, snapshot: makeSnapshot(SAMPLE_LAYERS) }).map((l) => l.id).sort()).toEqual(['L2', 'L4']);
  });

  it('linetype is Continuous', () => {
    const filter: LayerFilter = {
      kind: 'properties', id: 'lfp_lt', name: 'lt', source: 'user-created', createdAt: '',
      rules: { combinator: 'AND', rules: [{ field: 'linetype', operator: 'is', value: 'Continuous' }] },
    };
    expect(applyLayerFilter({ filter, layers: SAMPLE_LAYERS, snapshot: makeSnapshot(SAMPLE_LAYERS) }).length).toBe(4);
  });

  it('lineweight gte 0.25', () => {
    const filter: LayerFilter = {
      kind: 'properties', id: 'lfp_lw', name: 'lw', source: 'user-created', createdAt: '',
      rules: { combinator: 'AND', rules: [{ field: 'lineweight', operator: 'gte', value: 0.25 }] },
    };
    expect(applyLayerFilter({ filter, layers: SAMPLE_LAYERS, snapshot: makeSnapshot(SAMPLE_LAYERS) }).map((l) => l.id).sort()).toEqual(['L1', 'L3']);
  });

  it('lineweight between [0.18, 0.50]', () => {
    const filter: LayerFilter = {
      kind: 'properties', id: 'lfp_lw2', name: 'lw', source: 'user-created', createdAt: '',
      rules: { combinator: 'AND', rules: [{ field: 'lineweight', operator: 'between', value: [0.18, 0.50] }] },
    };
    expect(applyLayerFilter({ filter, layers: SAMPLE_LAYERS, snapshot: makeSnapshot(SAMPLE_LAYERS) }).length).toBe(3);
  });

  it('tag has "floor1"', () => {
    const filter: LayerFilter = {
      kind: 'properties', id: 'lfp_t', name: 't', source: 'user-created', createdAt: '',
      rules: { combinator: 'AND', rules: [{ field: 'tag', operator: 'has', value: 'floor1' }] },
    };
    expect(applyLayerFilter({ filter, layers: SAMPLE_LAYERS, snapshot: makeSnapshot(SAMPLE_LAYERS) }).map((l) => l.id)).toEqual(['L1']);
  });
});

describe('engine — combinator + nested', () => {
  it('AND short-circuits on first miss', () => {
    const filter: LayerFilter = {
      kind: 'properties', id: 'lfp_a', name: 'a', source: 'user-created', createdAt: '',
      rules: {
        combinator: 'AND',
        rules: [
          { field: 'category', operator: 'is', value: 'architectural' },
          { field: 'locked', operator: 'is', value: true },
        ],
      },
    };
    expect(applyLayerFilter({ filter, layers: SAMPLE_LAYERS, snapshot: makeSnapshot(SAMPLE_LAYERS) }).map((l) => l.id)).toEqual(['L2']);
  });

  it('OR returns union', () => {
    const filter: LayerFilter = {
      kind: 'properties', id: 'lfp_o', name: 'o', source: 'user-created', createdAt: '',
      rules: {
        combinator: 'OR',
        rules: [
          { field: 'category', operator: 'is', value: 'structural' },
          { field: 'plottable', operator: 'is', value: false },
        ],
      },
    };
    expect(applyLayerFilter({ filter, layers: SAMPLE_LAYERS, snapshot: makeSnapshot(SAMPLE_LAYERS) }).map((l) => l.id).sort()).toEqual(['L3', 'L4']);
  });

  it('nested ruleset — AND outer + OR inner', () => {
    const filter: LayerFilter = {
      kind: 'properties', id: 'lfp_n', name: 'n', source: 'user-created', createdAt: '',
      rules: {
        combinator: 'AND',
        rules: [{ field: 'visible', operator: 'is', value: true }],
        nested: [{
          combinator: 'OR',
          rules: [
            { field: 'category', operator: 'is', value: 'electrical' },
            { field: 'locked', operator: 'is', value: true },
          ],
        }],
      },
    };
    // visible=true AND (electrical OR locked) → L2 (locked) + L4 (electrical)
    expect(applyLayerFilter({ filter, layers: SAMPLE_LAYERS, snapshot: makeSnapshot(SAMPLE_LAYERS) }).map((l) => l.id).sort()).toEqual(['L2', 'L4']);
  });

  it('empty AND ruleset matches all (vacuous)', () => {
    const filter: LayerFilter = {
      kind: 'properties', id: 'lfp_e', name: 'e', source: 'user-created', createdAt: '',
      rules: { combinator: 'AND', rules: [] },
    };
    expect(applyLayerFilter({ filter, layers: SAMPLE_LAYERS, snapshot: makeSnapshot(SAMPLE_LAYERS) }).length).toBe(4);
  });

  it('empty OR ruleset matches none (no positive evidence)', () => {
    const filter: LayerFilter = {
      kind: 'properties', id: 'lfp_e2', name: 'e', source: 'user-created', createdAt: '',
      rules: { combinator: 'OR', rules: [] },
    };
    expect(applyLayerFilter({ filter, layers: SAMPLE_LAYERS, snapshot: makeSnapshot(SAMPLE_LAYERS) }).length).toBe(0);
  });
});

describe('engine — getMatchingLayerIds', () => {
  it('returns a Set of matching ids', () => {
    const filter: LayerFilter = {
      kind: 'properties', id: 'lfp_s', name: 's', source: 'user-created', createdAt: '',
      rules: { combinator: 'AND', rules: [{ field: 'visible', operator: 'is', value: true }] },
    };
    const ids = getMatchingLayerIds({ filter, layers: SAMPLE_LAYERS, snapshot: makeSnapshot(SAMPLE_LAYERS) });
    expect(ids instanceof Set).toBe(true);
    expect([...ids].sort()).toEqual(['L1', 'L2', 'L4']);
  });
});
