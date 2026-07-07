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
// ADR-378 / ADR-557 — the snap points now derive from the SAME grip box the user sees, so
// tests assert parity against `resolveTextBox` (not a hand-computed heuristic bbox).
import { projectSceneTextToDxf } from '../../../bim/text/project-scene-text';
import { resolveTextBox } from '../../../bim/text/text-box';
import { rectCornerWorld, rectEdgeWorld } from '../../../bim/grips/rect-frame';

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

/** The SAME visual grip box the engine derives its snap points from. */
function gripFrame(entity: TextEntity | MTextEntity) {
  return resolveTextBox(projectSceneTextToDxf(entity as unknown as Parameters<typeof projectSceneTextToDxf>[0], entity.id));
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

  it('corners / edge-mids / center coincide with the text grip box (resolveTextBox)', () => {
    const e = makeText({ position: { x: 0, y: 0 } });
    engine.initialize([e]);
    const { candidates } = engine.findSnapCandidates({ x: 0, y: 0 }, makeContext());
    const frame = gripFrame(e);
    const at = (d: string) => candidates.find((c) => c.description === d)!.point;
    const same = (d: string, p: { x: number; y: number }) => { expectClose(at(d).x, p.x); expectClose(at(d).y, p.y); };
    same('text-corner-tr', rectCornerWorld(frame, { sx: 1, sy: 1 }));
    same('text-corner-tl', rectCornerWorld(frame, { sx: -1, sy: 1 }));
    same('text-corner-bl', rectCornerWorld(frame, { sx: -1, sy: -1 }));
    same('text-corner-br', rectCornerWorld(frame, { sx: 1, sy: -1 }));
    same('text-center', frame.center);
    same('text-edge-top-mid', rectEdgeWorld(frame, { axis: 'y', sign: 1 }));
    same('text-edge-bottom-mid', rectEdgeWorld(frame, { axis: 'y', sign: -1 }));
  });

  it('MTEXT snap box uses the frame width (coincides with its grip box)', () => {
    const e = makeMText({ position: { x: 0, y: 0 }, width: 40 });
    engine.initialize([e]);
    const { candidates } = engine.findSnapCandidates({ x: 0, y: 0 }, makeContext());
    const expected = rectCornerWorld(gripFrame(e), { sx: 1, sy: 1 });
    const tr = candidates.find((c) => c.description === 'text-corner-tr')!;
    expect(tr).toBeDefined();
    expectClose(tr.point.x, expected.x);
    expectClose(tr.point.y, expected.y);
  });

  it('in-app text (content ONLY in textNode) produces 8 grip-coincident points', () => {
    const e = {
      id: 'tn', name: 'tn', type: 'text', layerId: '0', position: { x: 3, y: 4 }, visible: true,
      textNode: { paragraphs: [{ runs: [{ text: 'AB', style: { height: 10 } }] }], attachment: 'BL' },
    } as unknown as TextEntity;
    engine.initialize([e]);
    const { candidates } = engine.findSnapCandidates({ x: 3, y: 4 }, makeContext());
    expect(candidates).toHaveLength(8);
    const expected = rectCornerWorld(gripFrame(e), { sx: 1, sy: 1 });
    const tr = candidates.find((c) => c.description === 'text-corner-tr')!.point;
    expectClose(tr.x, expected.x);
    expectClose(tr.y, expected.y);
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

  it('rotation is applied — corner-tr matches the rotated grip-box corner', () => {
    const e = makeText({ position: { x: 0, y: 0 }, rotation: 90 });
    engine.initialize([e]);
    const { candidates } = engine.findSnapCandidates({ x: 0, y: 0 }, makeContext());
    const expected = rectCornerWorld(gripFrame(e), { sx: 1, sy: 1 });
    const tr = candidates.find((c) => c.description === 'text-corner-tr')!;
    expect(tr).toBeDefined();
    expectClose(tr.point.x, expected.x, 1e-5);
    expectClose(tr.point.y, expected.y, 1e-5);
    // Sanity: a 90° rotation must actually move the corner off the +X axis.
    expect(Math.abs(expected.y)).toBeGreaterThan(1e-3);
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
