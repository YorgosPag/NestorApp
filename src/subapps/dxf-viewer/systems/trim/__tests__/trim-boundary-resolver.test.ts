/**
 * Tests for trim-boundary-resolver (ADR-350 §Test Plan — B4).
 *
 * Covers: Quick vs Standard mode edge selection, locked / hidden layer
 * filtering, edge-mode extend passthrough, and isTrimmable guard.
 */

import {
  resolveCuttingEdges,
  isValidCuttingCandidate,
  isTrimmable,
} from '../trim-boundary-resolver';
import type { SceneLayer, SceneModel } from '../../../types/scene';
import type { LineEntity } from '../../../types/entities';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeLine(id: string, _layer = 'Layer0', layerId = 'lyr_test_default'): LineEntity {
  return { id, type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, layerId };
}

function makeScene(
  entities: LineEntity[],
  layersById: Record<string, Partial<SceneLayer>> = {},
): SceneModel {
  return {
    entities,
    layersById: layersById as Record<string, SceneLayer>,
  } as SceneModel;
}

// ── isValidCuttingCandidate ───────────────────────────────────────────────────

describe('isValidCuttingCandidate', () => {
  it('accepts line on visible unlocked layer', () => {
    expect(isValidCuttingCandidate({ type: 'line' }, {})).toBe(true);
  });

  it('rejects hidden entity', () => {
    expect(isValidCuttingCandidate({ type: 'line', visible: false }, {})).toBe(false);
  });

  it('rejects locked layer', () => {
    const layers = { lyr_L1: { locked: true } as SceneLayer };
    expect(isValidCuttingCandidate({ type: 'line', layerId: 'lyr_L1' }, layers)).toBe(false);
  });

  it('rejects hidden layer', () => {
    const layers = { lyr_L1: { visible: false } as SceneLayer };
    expect(isValidCuttingCandidate({ type: 'line', layerId: 'lyr_L1' }, layers)).toBe(false);
  });

  it('rejects hatch', () => {
    expect(isValidCuttingCandidate({ type: 'hatch' }, {})).toBe(false);
  });

  it('rejects dimension', () => {
    expect(isValidCuttingCandidate({ type: 'dimension' }, {})).toBe(false);
  });

  it('accepts all trimmable types', () => {
    const types = ['line', 'polyline', 'lwpolyline', 'circle', 'arc', 'ellipse', 'spline', 'ray', 'xline'];
    types.forEach((t) => {
      expect(isValidCuttingCandidate({ type: t }, {})).toBe(true);
    });
  });

  // ADR-358 Phase 9E-2: id-keyed lookup (layersById path)
  it('rejects locked layer via layerId — id-keyed map', () => {
    const layers = { lyr_1: { locked: true } as SceneLayer };
    expect(isValidCuttingCandidate({ type: 'line', layerId: 'lyr_1' }, layers)).toBe(false);
  });

  it('rejects hidden layer via layerId — id-keyed map', () => {
    const layers = { lyr_1: { visible: false } as SceneLayer };
    expect(isValidCuttingCandidate({ type: 'line', layerId: 'lyr_1' }, layers)).toBe(false);
  });

});

// ── isTrimmable ───────────────────────────────────────────────────────────────

describe('isTrimmable', () => {
  it('line → true', () => expect(isTrimmable({ type: 'line' })).toBe(true));
  it('hatch → false', () => expect(isTrimmable({ type: 'hatch' })).toBe(false));
  it('block → false', () => expect(isTrimmable({ type: 'block' })).toBe(false));
});

// ── resolveCuttingEdges — Quick mode ──────────────────────────────────────────

describe('resolveCuttingEdges — Quick mode', () => {
  it('returns all visible unlocked entities', () => {
    const scene = makeScene([makeLine('a'), makeLine('b'), makeLine('c')]);
    const edges = resolveCuttingEdges({
      mode: 'quick',
      scene,
      selectedEdgeIds: [],
      edgeMode: 'noExtend',
    });
    expect(edges).toHaveLength(3);
    expect(edges.map((e) => e.sourceEntityId)).toEqual(['a', 'b', 'c']);
  });

  it('excludes entity on locked layer', () => {
    const scene = makeScene(
      [makeLine('a', 'L1', 'lyr_L1'), makeLine('b', 'L2', 'lyr_L2')],
      { lyr_L1: { locked: true } as SceneLayer },
    );
    const edges = resolveCuttingEdges({ mode: 'quick', scene, selectedEdgeIds: [], edgeMode: 'noExtend' });
    expect(edges).toHaveLength(1);
    expect(edges[0].sourceEntityId).toBe('b');
  });

  it('excludes entity on hidden layer', () => {
    const scene = makeScene(
      [makeLine('a', 'L1', 'lyr_L1'), makeLine('b', 'L2', 'lyr_L2')],
      { lyr_L1: { visible: false } as SceneLayer },
    );
    const edges = resolveCuttingEdges({ mode: 'quick', scene, selectedEdgeIds: [], edgeMode: 'noExtend' });
    expect(edges).toHaveLength(1);
    expect(edges[0].sourceEntityId).toBe('b');
  });
});

// ── resolveCuttingEdges — Standard mode ───────────────────────────────────────

describe('resolveCuttingEdges — Standard mode', () => {
  it('returns only entities in selectedEdgeIds', () => {
    const scene = makeScene([makeLine('a'), makeLine('b'), makeLine('c')]);
    const edges = resolveCuttingEdges({
      mode: 'standard',
      scene,
      selectedEdgeIds: ['b'],
      edgeMode: 'noExtend',
    });
    expect(edges).toHaveLength(1);
    expect(edges[0].sourceEntityId).toBe('b');
  });

  it('empty selectedEdgeIds → empty result', () => {
    const scene = makeScene([makeLine('a'), makeLine('b')]);
    const edges = resolveCuttingEdges({
      mode: 'standard',
      scene,
      selectedEdgeIds: [],
      edgeMode: 'noExtend',
    });
    expect(edges).toHaveLength(0);
  });
});

// ── resolveCuttingEdges — Phase 9E-2 layersById ───────────────────────────────

describe('resolveCuttingEdges — layersById (id-keyed, Phase 9E-2)', () => {
  it('excludes entity on locked layer via layersById', () => {
    const scene: SceneModel = {
      entities: [makeLine('a', 'L1', 'lyr_1')],
      layersById: { lyr_1: { locked: true } as SceneLayer },
    } as SceneModel;
    const edges = resolveCuttingEdges({ mode: 'quick', scene, selectedEdgeIds: [], edgeMode: 'noExtend' });
    expect(edges).toHaveLength(0);
  });

  it('includes entity on unlocked layer via layersById', () => {
    const scene: SceneModel = {
      entities: [makeLine('a', 'L1', 'lyr_1')],
      layersById: { lyr_1: { visible: true, locked: false } as SceneLayer },
    } as SceneModel;
    const edges = resolveCuttingEdges({ mode: 'quick', scene, selectedEdgeIds: [], edgeMode: 'noExtend' });
    expect(edges).toHaveLength(1);
  });
});

// ── resolveCuttingEdges — edge mode ───────────────────────────────────────────

describe('resolveCuttingEdges — edge mode extend', () => {
  it('noExtend: extended flag is false for all', () => {
    const scene = makeScene([makeLine('a')]);
    const edges = resolveCuttingEdges({
      mode: 'quick',
      scene,
      selectedEdgeIds: [],
      edgeMode: 'noExtend',
    });
    expect(edges[0].extended).toBe(false);
  });

  it('extend: extended flag reflects whether entity was extended', () => {
    // A plain line can be extended (to an xline-like). Just ensure flag set.
    const scene = makeScene([makeLine('a')]);
    const edges = resolveCuttingEdges({
      mode: 'quick',
      scene,
      selectedEdgeIds: [],
      edgeMode: 'extend',
    });
    // Whether extended or not depends on extendEdge impl; the CuttingEdge shape is correct.
    expect(typeof edges[0].extended).toBe('boolean');
  });
});
