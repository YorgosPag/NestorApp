/**
 * ADR-378 Phase 3 — TextSnapEngine tests.
 *
 * Verifies:
 *   - Only TEXT/MTEXT entities produce candidates (other entity types ignored).
 *   - 8 snap points emitted per visible text entity (insertion + 4 corners + center + 2 edge mids).
 *   - Insertion point at entity.position.
 *   - Bounding-box-derived points respect entity.fontSize / text length (TEXT) or width × height (MTEXT).
 *   - Rotation applied around insertion point.
 *   - Candidate type = TEXT, description = `text-${kind}`.
 *   - excludeEntityId suppresses all 8 candidates for that entity.
 *   - Cursor outside radius returns no candidates.
 *   - invisible entities ignored.
 *   - Multiple text entities indexed independently.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TextSnapEngine } from '../TextSnapEngine';
import { ExtendedSnapType } from '../../extended-types';
import type { SnapEngineContext } from '../../shared/BaseSnapEngine';
import type { EntityModel, TextEntity, MTextEntity } from '../../../types/entities';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeText(
  overrides: Partial<TextEntity> = {},
  id = 'txt_1',
): TextEntity {
  return {
    id,
    name: id,
    type: 'text',
    layerId: '0',
    text: 'AB',
    position: { x: 0, y: 0 },
    fontSize: 10,
    rotation: 0,
    visible: true,
    ...overrides,
  } as TextEntity;
}

function makeMText(
  overrides: Partial<MTextEntity> = {},
  id = 'mtxt_1',
): MTextEntity {
  return {
    id,
    name: id,
    type: 'mtext',
    layerId: '0',
    text: 'M',
    position: { x: 0, y: 0 },
    width: 20,
    fontSize: 10,
    rotation: 0,
    visible: true,
    ...overrides,
  } as MTextEntity;
}

function makeLine(id = 'line_1'): EntityModel {
  return {
    id,
    name: id,
    type: 'line',
    layerId: '0',
    start: { x: 0, y: 0 },
    end: { x: 100, y: 0 },
    visible: true,
  } as EntityModel;
}

function makeContext(overrides: Partial<SnapEngineContext> = {}): SnapEngineContext {
  return {
    entities: [],
    worldRadiusAt: () => 200,
    worldRadiusForType: () => 200,
    maxCandidates: 10,
    ...overrides,
  };
}

const EPS = 1e-6;

function expectClose(actual: number, expected: number, eps = EPS) {
  expect(Math.abs(actual - expected)).toBeLessThan(eps);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('TextSnapEngine — ADR-378 Phase 3', () => {
  let engine: TextSnapEngine;

  beforeEach(() => {
    engine = new TextSnapEngine();
  });

  afterEach(() => {
    engine.dispose();
  });

  it('no candidates when initialized with empty entity list', () => {
    engine.initialize([]);
    const { candidates } = engine.findSnapCandidates({ x: 0, y: 0 }, makeContext());
    expect(candidates).toHaveLength(0);
  });

  it('non-text entities produce no candidates', () => {
    engine.initialize([makeLine()]);
    const { candidates } = engine.findSnapCandidates({ x: 0, y: 0 }, makeContext());
    expect(candidates).toHaveLength(0);
  });

  it('text entity at origin produces 8 candidates within radius', () => {
    // bbox ≈ width 2*10*0.6=12, height 10. Center at (6,5). Radius 200 catches all.
    engine.initialize([makeText({ position: { x: 0, y: 0 } })]);
    const { candidates } = engine.findSnapCandidates({ x: 0, y: 0 }, makeContext());
    expect(candidates).toHaveLength(8);
  });

  it('insertion point exactly matches entity.position', () => {
    engine.initialize([makeText({ position: { x: 7, y: 5 } })]);
    const { candidates } = engine.findSnapCandidates({ x: 7, y: 5 }, makeContext());
    const insertion = candidates.find((c) => c.description === 'text-insertion')!;
    expect(insertion).toBeDefined();
    expectClose(insertion.point.x, 7);
    expectClose(insertion.point.y, 5);
  });

  it('all candidates have type TEXT and priority 2', () => {
    engine.initialize([makeText()]);
    const { candidates } = engine.findSnapCandidates({ x: 0, y: 0 }, makeContext());
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.every((c) => c.type === ExtendedSnapType.TEXT)).toBe(true);
    expect(candidates.every((c) => c.priority === 2)).toBe(true);
  });

  it('descriptions encode all 8 kinds', () => {
    engine.initialize([makeText()]);
    const { candidates } = engine.findSnapCandidates({ x: 0, y: 0 }, makeContext());
    const kinds = candidates.map((c) => c.description).sort();
    expect(kinds).toEqual([
      'text-center',
      'text-corner-bl',
      'text-corner-br',
      'text-corner-tl',
      'text-corner-tr',
      'text-edge-bottom-mid',
      'text-edge-top-mid',
      'text-insertion',
    ]);
  });

  it('mtext entity uses entity.width for bbox width', () => {
    // width=40 → corner-tr local (40,0). Rotation 0 → world (40, 0) when position (0,0).
    engine.initialize([makeMText({ position: { x: 0, y: 0 }, width: 40 })]);
    const { candidates } = engine.findSnapCandidates({ x: 40, y: 0 }, makeContext({ worldRadiusForType: () => 1 }));
    const tr = candidates.find((c) => c.description === 'text-corner-tr')!;
    expect(tr).toBeDefined();
    expectClose(tr.point.x, 40);
    expectClose(tr.point.y, 0);
  });

  it('cursor outside radius returns no candidates', () => {
    engine.initialize([makeText({ position: { x: 0, y: 0 } })]);
    const ctx = makeContext({ worldRadiusForType: () => 1 });
    const { candidates } = engine.findSnapCandidates({ x: 1000, y: 1000 }, ctx);
    expect(candidates).toHaveLength(0);
  });

  it('excludeEntityId suppresses all 8 points of matching entity', () => {
    engine.initialize([makeText({ position: { x: 0, y: 0 } }, 'txt_excluded')]);
    const ctx = makeContext({ excludeEntityId: 'txt_excluded' });
    const { candidates } = engine.findSnapCandidates({ x: 0, y: 0 }, ctx);
    expect(candidates).toHaveLength(0);
  });

  it('invisible entities are not indexed', () => {
    engine.initialize([makeText({ visible: false })]);
    const { candidates } = engine.findSnapCandidates({ x: 0, y: 0 }, makeContext());
    expect(candidates).toHaveLength(0);
  });

  it('rotation 90° rotates corner-tr around insertion point', () => {
    // Text at origin, rotation 90°. bbox width 12 (text='AB' length 2 * 10 * 0.6). Local corner-tr (12,0).
    // Rotated 90° CCW around origin → (0, 12).
    engine.initialize([makeText({ position: { x: 0, y: 0 }, rotation: 90 })]);
    const { candidates } = engine.findSnapCandidates({ x: 0, y: 12 }, makeContext({ worldRadiusForType: () => 1 }));
    const tr = candidates.find((c) => c.description === 'text-corner-tr')!;
    expect(tr).toBeDefined();
    expectClose(tr.point.x, 0, 1e-5);
    expectClose(tr.point.y, 12, 1e-5);
  });

  it('multiple text entities indexed independently — each contributes 8 points', () => {
    const a = makeText({ position: { x: 0, y: 0 } }, 'txt_a');
    const b = makeText({ position: { x: 500, y: 500 } }, 'txt_b');
    engine.initialize([a, b]);

    const nearA = engine.findSnapCandidates({ x: 0, y: 0 }, makeContext());
    expect(nearA.candidates.every((c) => c.entityId === 'txt_a')).toBe(true);
    expect(nearA.candidates).toHaveLength(8);

    const nearB = engine.findSnapCandidates(
      { x: 500, y: 500 },
      makeContext({ worldRadiusForType: () => 1 }),
    );
    expect(nearB.candidates.some((c) => c.entityId === 'txt_b')).toBe(true);
    expect(nearB.candidates.every((c) => c.entityId === 'txt_b')).toBe(true);
  });

  it('mixed entities — only text produces candidates', () => {
    engine.initialize([makeLine('ln'), makeText({}, 'txt_m')]);
    const { candidates } = engine.findSnapCandidates({ x: 0, y: 0 }, makeContext());
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.every((c) => c.entityId === 'txt_m')).toBe(true);
  });

  it('dispose clears indexed points', () => {
    engine.initialize([makeText()]);
    engine.dispose();
    const { candidates } = engine.findSnapCandidates({ x: 0, y: 0 }, makeContext());
    expect(candidates).toHaveLength(0);
  });
});
