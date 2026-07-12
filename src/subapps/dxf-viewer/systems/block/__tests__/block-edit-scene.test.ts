import { buildBlockEditScene, resolveBlockEditScene } from '../block-edit-scene';
import type { BlockEntity, Entity, SceneLayer } from '../../../types/entities';
import type { SceneModel } from '../../../types/scene';

/**
 * ADR-641 Φ1 — synthetic BLOCK-LOCAL scene builder. Proves the editor scene shows the block's
 * members in LOCAL space (identity placement — NO world transform applied despite a non-trivial
 * position/scale/rotation), keeps member ids (individual editing), passes the layer map through,
 * and computes real bounds via the shared SSoT.
 */

const layer = (id: string): SceneLayer =>
  ({ id, name: 'L', color: '#fff', visible: true, locked: false } as SceneLayer);

function memberLine(id: string, sx: number, sy: number, ex: number, ey: number): Entity {
  return { id, type: 'line', layerId: 'lyr1', start: { x: sx, y: sy }, end: { x: ex, y: ey } } as unknown as Entity;
}

/** A block placed far from origin, scaled + rotated — to prove the editor ignores the placement. */
function block(): BlockEntity {
  return {
    id: 'blk1', type: 'block', name: '*U2', layerId: 'lyr1', visible: true,
    position: { x: 5000, y: 9000 }, scale: { x: 3, y: 3 }, rotation: 90,
    entities: [memberLine('m0', 0, 0, 10, 0), memberLine('m1', 0, 0, 0, 20)],
  } as BlockEntity;
}

const LAYERS = { lyr1: layer('lyr1') };

describe('buildBlockEditScene', () => {
  it('returns the members in LOCAL space (identity — no placement transform)', () => {
    const scene = buildBlockEditScene(block(), LAYERS);
    expect(scene.entities).toHaveLength(2);
    const m0 = scene.entities.find((e) => e.id === 'm0') as unknown as { start: { x: number; y: number }; end: { x: number; y: number } };
    // Despite position (5000,9000), scale 3, rotation 90°, the stored local coords are untouched.
    expect(m0.start).toEqual({ x: 0, y: 0 });
    expect(m0.end).toEqual({ x: 10, y: 0 });
  });

  it('preserves member ids (individual editing, not re-tagged to the block id)', () => {
    const scene = buildBlockEditScene(block(), LAYERS);
    expect(scene.entities.map((e) => e.id).sort()).toEqual(['m0', 'm1']);
    expect(scene.entities.some((e) => e.id === 'blk1')).toBe(false);
  });

  it('passes the layer map through and reports mm units', () => {
    const scene = buildBlockEditScene(block(), LAYERS);
    expect(scene.layersById).toBe(LAYERS);
    expect(scene.units).toBe('mm');
  });

  it('computes real bounds over the local members', () => {
    const scene = buildBlockEditScene(block(), LAYERS);
    expect(scene.bounds.min).toEqual({ x: 0, y: 0 });
    expect(scene.bounds.max).toEqual({ x: 10, y: 20 });
  });

  it('returns a FRESH entities array each call (React memo correctness)', () => {
    const b = block();
    expect(buildBlockEditScene(b, LAYERS).entities).not.toBe(buildBlockEditScene(b, LAYERS).entities);
  });
});

/**
 * ADR-641 Φ2 — the exclusive-render-scope resolver. Proves the canvas scene source flips to the
 * block-local synthetic scene ONLY while a block is entered, is a no-op (same ref) otherwise, and
 * falls back safely when the active id no longer resolves to a block.
 */
describe('resolveBlockEditScene', () => {
  const worldScene = (): SceneModel => ({
    entities: [memberLine('w0', 0, 0, 1, 0), block()],
    layersById: LAYERS,
    bounds: { min: { x: 0, y: 0 }, max: { x: 5010, y: 9020 } },
    units: 'mm',
  } as unknown as SceneModel);

  it('returns the SAME world scene reference at the top level (activeId null)', () => {
    const scene = worldScene();
    expect(resolveBlockEditScene(scene, null)).toBe(scene);
  });

  it('passes null scene through unchanged', () => {
    expect(resolveBlockEditScene(null, 'blk1')).toBeNull();
  });

  it('swaps to the entered block\'s block-local synthetic scene', () => {
    const swapped = resolveBlockEditScene(worldScene(), 'blk1');
    // ONLY the block members, base @ origin (no world entity, no block container).
    expect(swapped?.entities.map((e) => e.id).sort()).toEqual(['m0', 'm1']);
    expect(swapped?.bounds.min).toEqual({ x: 0, y: 0 });
    expect(swapped?.bounds.max).toEqual({ x: 10, y: 20 });
  });

  it('falls back to the world scene when the active id is not a block', () => {
    const scene = worldScene();
    // 'w0' is a line, not a block → safe fallback (never blank the canvas).
    expect(resolveBlockEditScene(scene, 'w0')).toBe(scene);
  });

  it('falls back to the world scene when the active id is gone (deleted / level switched)', () => {
    const scene = worldScene();
    expect(resolveBlockEditScene(scene, 'missing')).toBe(scene);
  });
});
