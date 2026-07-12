import { resolveBlockEditScene } from '../block-edit-scene';
import type { SceneModel } from '../../../types/scene';
import type { BlockEntity, Entity, SceneLayer } from '../../../types/entities';

/**
 * ADR-641 — the drawing + dimension tools' OWN snap manager / entity-detection
 * (`useDrawingHandlers`) must read the EFFECTIVE (block-local) scene while a Block Editor session is
 * open, exactly like the canvas render / hit-test / main snap engine. Otherwise, inside BEDIT they
 * snap and pick against the WORLD scene the editor isn't showing:
 *   - dim «select object» resolves the picked entity by id in the world scene → the block member is
 *     NOT a top-level entity → not found → collapsed def-points → a ZERO-length dimension;
 *   - snap grabs distant world geometry → def-points land in the wrong frame → the dimension appears
 *     FAR from the block once the editor is closed.
 *
 * These pin the two lookups `useDrawingHandlers` performs (entity-by-id resolver + scene-entities for
 * snap) with the REAL SSoT resolver (no mocks).
 */

const layer = (id: string): SceneLayer =>
  ({ id, name: 'L', color: '#fff', visible: true, locked: false } as SceneLayer);

const memberLine = (id: string, sx: number, sy: number, ex: number, ey: number): Entity =>
  ({ id, type: 'line', layerId: 'lyr1', start: { x: sx, y: sy }, end: { x: ex, y: ey } } as unknown as Entity);

const block = (): BlockEntity =>
  ({
    id: 'blk1', type: 'block', name: '*U2', layerId: 'lyr1', visible: true,
    position: { x: 5000, y: 9000 }, scale: { x: 1, y: 1 }, rotation: 0,
    entities: [memberLine('m0', 0, 0, 10, 0), memberLine('m1', 0, 0, 0, 20)],
  } as BlockEntity);

const LAYERS = { lyr1: layer('lyr1') };

const worldScene = (): SceneModel =>
  ({
    entities: [memberLine('w0', 0, 0, 1, 0), block()],
    layersById: LAYERS,
    bounds: { min: { x: 0, y: 0 }, max: { x: 5010, y: 9020 } },
    units: 'mm',
  } as unknown as SceneModel);

/** The by-id entity resolver `useDrawingHandlers` feeds the dim smart-detector. */
const resolveEntityById = (scene: SceneModel | undefined, id: string) =>
  scene?.entities.find((e) => e.id === id);

describe('ADR-641 — drawing/dim entity-pick resolver scope inside BEDIT', () => {
  it('the WORLD scene does NOT contain the block member as a top-level entity (the «zero» bug)', () => {
    expect(resolveEntityById(worldScene(), 'm0')).toBeUndefined();
  });

  it('the effective (block-local) scene resolves the picked member by id', () => {
    const effective = resolveBlockEditScene(worldScene(), 'blk1') ?? undefined;
    const m0 = resolveEntityById(effective, 'm0') as unknown as { start: { x: number; y: number }; end: { x: number; y: number } } | undefined;
    // Real, non-degenerate local endpoints → a real dimension length (not zero).
    expect(m0?.start).toEqual({ x: 0, y: 0 });
    expect(m0?.end).toEqual({ x: 10, y: 0 });
  });

  it('the effective scene entities (snap targets) are the block members, not the world entities', () => {
    const effective = resolveBlockEditScene(worldScene(), 'blk1') ?? undefined;
    expect(effective?.entities.map((e) => e.id).sort()).toEqual(['m0', 'm1']);
    // The world entity «w0» and the block container are NOT snap targets inside the editor.
    expect(effective?.entities.some((e) => e.id === 'w0' || e.id === 'blk1')).toBe(false);
  });

  it('outside the editor the resolver/targets are the world scene unchanged (drop-in, same ref)', () => {
    const scene = worldScene();
    const effective = resolveBlockEditScene(scene, null) ?? undefined;
    expect(effective).toBe(scene);
    expect(resolveEntityById(effective, 'w0')?.id).toBe('w0');
  });
});
