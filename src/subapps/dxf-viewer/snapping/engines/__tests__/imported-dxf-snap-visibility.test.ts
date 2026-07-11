/**
 * ADR-378 — Imported-DXF snap visibility regression.
 *
 * BUG: imported DXF entities are persisted WITHOUT the optional `visible` field
 * (`{ id, type, layerId, color, start, end }`). Snap engines that filtered with a
 * naive truthy check (`if (!entity.visible) continue;`) treated `undefined` the same
 * as `false` and silently dropped every imported line from the spatial index, so the
 * user could not snap a new line's endpoint onto an imported line's endpoint — while
 * app-drawn lines (which set `visible: true`) snapped fine.
 *
 * FIX: SSoT predicate `isEntityVisibleForSnap` — only an explicit `visible === false`
 * excludes an entity from snapping; a missing `visible` means visible.
 *
 * These tests lock the behaviour end-to-end through the EndpointSnapEngine (the exact
 * path in Giorgio's report) plus a unit check of the predicate.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { EndpointSnapEngine } from '../EndpointSnapEngine';
import { isEntityVisibleForSnap } from '../../shared/snap-visibility';
import type { SnapEngineContext } from '../../shared/BaseSnapEngine';
import type { EntityModel } from '../../../types/entities';

// An imported DXF line: minimal 6-field shape, NO `visible` field.
function makeImportedLine(id = 'ent_imported'): EntityModel {
  return {
    id,
    type: 'line',
    layerId: '',
    color: '#FF00FF',
    start: { x: 0, y: 0 },
    end: { x: 100, y: 0 },
  } as unknown as EntityModel;
}

// An app-drawn line: full shape with explicit visible: true.
function makeDrawnLine(id = 'entity_drawn', visible = true): EntityModel {
  return {
    id,
    type: 'line',
    layerId: '',
    color: '#00FF00',
    start: { x: 0, y: 0 },
    end: { x: 100, y: 0 },
    visible,
  } as unknown as EntityModel;
}

// An imported open polyline with direction-change vertices (Giorgio's report):
// only the two end vertices used to be snappable — the 3 corners in between were
// silently dropped from the ENDPOINT index.
function makeOpenPolyline(id = 'ent_polyline'): EntityModel {
  return {
    id,
    type: 'polyline',
    layerId: '',
    color: '#FFFFFF',
    closed: false,
    vertices: [
      { x: 0, y: 0 },      // end vertex
      { x: 100, y: 0 },    // corner (direction change)
      { x: 100, y: 100 },  // corner (direction change)
      { x: 200, y: 100 },  // end vertex
    ],
  } as unknown as EntityModel;
}

function makeClosedPolyline(id = 'ent_polyline_closed'): EntityModel {
  return {
    id,
    type: 'polyline',
    layerId: '',
    color: '#FFFFFF',
    closed: true,
    vertices: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ],
  } as unknown as EntityModel;
}

function makeContext(overrides: Partial<SnapEngineContext> = {}): SnapEngineContext {
  return {
    entities: [],
    worldRadiusAt: () => 5,
    worldRadiusForType: () => 5,
    maxCandidates: 10,
    ...overrides,
  };
}

describe('isEntityVisibleForSnap — SSoT predicate', () => {
  it('missing `visible` (imported DXF) counts as visible', () => {
    expect(isEntityVisibleForSnap({})).toBe(true);
  });

  it('explicit `visible: true` is visible', () => {
    expect(isEntityVisibleForSnap({ visible: true })).toBe(true);
  });

  it('only explicit `visible: false` is hidden', () => {
    expect(isEntityVisibleForSnap({ visible: false })).toBe(false);
  });
});

describe('EndpointSnapEngine — imported DXF endpoints snap (ADR-378 regression)', () => {
  let engine: EndpointSnapEngine;

  beforeEach(() => {
    engine = new EndpointSnapEngine();
  });

  afterEach(() => {
    engine.dispose();
  });

  it('snaps to an imported line endpoint even though `visible` is undefined', () => {
    engine.initialize([makeImportedLine()]);
    // Cursor right on the imported line's END endpoint (100, 0).
    const { candidates } = engine.findSnapCandidates({ x: 100, y: 0 }, makeContext());
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0].entityId).toBe('ent_imported');
    expect(candidates[0].point).toEqual({ x: 100, y: 0 });
  });

  it('still snaps to an app-drawn line endpoint (no regression)', () => {
    engine.initialize([makeDrawnLine()]);
    const { candidates } = engine.findSnapCandidates({ x: 0, y: 0 }, makeContext());
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0].entityId).toBe('entity_drawn');
  });

  it('does NOT snap to an explicitly hidden line (visible: false honoured)', () => {
    engine.initialize([makeDrawnLine('entity_hidden', false)]);
    const { candidates } = engine.findSnapCandidates({ x: 0, y: 0 }, makeContext());
    expect(candidates).toHaveLength(0);
  });

  it('indexes both imported and drawn lines together', () => {
    engine.initialize([
      makeImportedLine('ent_a'),
      makeDrawnLine('entity_b'),
    ]);
    const nearImported = engine.findSnapCandidates({ x: 100, y: 0 }, makeContext());
    const nearDrawn = engine.findSnapCandidates({ x: 0, y: 0 }, makeContext());
    expect(nearImported.candidates.some(c => c.entityId === 'ent_a')).toBe(true);
    expect(nearDrawn.candidates.some(c => c.entityId === 'entity_b')).toBe(true);
  });
});

describe('EndpointSnapEngine — open polyline vertex endpoints (Revit-grade osnap)', () => {
  let engine: EndpointSnapEngine;

  beforeEach(() => {
    engine = new EndpointSnapEngine();
  });

  afterEach(() => {
    engine.dispose();
  });

  it('snaps to an INTERMEDIATE direction-change vertex (regression: Giorgio report)', () => {
    engine.initialize([makeOpenPolyline()]);
    // Corner between the two segments — used to be dropped from the index.
    const { candidates } = engine.findSnapCandidates({ x: 100, y: 0 }, makeContext());
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0].entityId).toBe('ent_polyline');
    expect(candidates[0].point).toEqual({ x: 100, y: 0 });
  });

  it('snaps to the second intermediate corner too', () => {
    engine.initialize([makeOpenPolyline()]);
    const { candidates } = engine.findSnapCandidates({ x: 100, y: 100 }, makeContext());
    expect(candidates.some(c => c.point.x === 100 && c.point.y === 100)).toBe(true);
  });

  it('still snaps to the first and last vertices (no regression)', () => {
    engine.initialize([makeOpenPolyline()]);
    const first = engine.findSnapCandidates({ x: 0, y: 0 }, makeContext());
    const last = engine.findSnapCandidates({ x: 200, y: 100 }, makeContext());
    expect(first.candidates.some(c => c.point.x === 0 && c.point.y === 0)).toBe(true);
    expect(last.candidates.some(c => c.point.x === 200 && c.point.y === 100)).toBe(true);
  });

  it('snaps to every vertex of a closed polyline', () => {
    engine.initialize([makeClosedPolyline()]);
    for (const v of [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }]) {
      const { candidates } = engine.findSnapCandidates(v, makeContext());
      expect(candidates.some(c => c.point.x === v.x && c.point.y === v.y)).toBe(true);
    }
  });
});
