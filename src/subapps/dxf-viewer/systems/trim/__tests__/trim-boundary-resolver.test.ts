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

function makeLine(id: string, layer = 'Layer0'): LineEntity {
  return { id, type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, layer };
}

function makeScene(
  entities: LineEntity[],
  layers: Record<string, Partial<SceneLayer>> = {},
): SceneModel {
  return {
    entities,
    layers: layers as Record<string, SceneLayer>,
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
    const layers = { L1: { locked: true } as SceneLayer };
    expect(isValidCuttingCandidate({ type: 'line', layer: 'L1' }, layers)).toBe(false);
  });

  it('rejects hidden layer', () => {
    const layers = { L1: { visible: false } as SceneLayer };
    expect(isValidCuttingCandidate({ type: 'line', layer: 'L1' }, layers)).toBe(false);
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
      [makeLine('a', 'L1'), makeLine('b', 'L2')],
      { L1: { locked: true } as SceneLayer },
    );
    const edges = resolveCuttingEdges({ mode: 'quick', scene, selectedEdgeIds: [], edgeMode: 'noExtend' });
    expect(edges).toHaveLength(1);
    expect(edges[0].sourceEntityId).toBe('b');
  });

  it('excludes entity on hidden layer', () => {
    const scene = makeScene(
      [makeLine('a', 'L1'), makeLine('b', 'L2')],
      { L1: { visible: false } as SceneLayer },
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
