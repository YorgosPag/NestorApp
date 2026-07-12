import { resolveBlockEditScene } from '../block-edit-scene';
import { calculateCombinedEntityBounds } from '../../selection/shared/selection-duplicate-utils';
import type { AnySceneEntity, SceneModel } from '../../../types/scene';
import type { BlockEntity, Entity, SceneLayer } from '../../../types/entities';

/**
 * ADR-641 — zoom-extents / fit-to-view SCOPE inside the Block Editor (BEDIT).
 *
 * Every fit path funnels its bounds through `resolveBlockEditScene(worldScene, activeBlockId)`: while
 * a block is entered it must frame the block's LOCAL extents (base @ origin), NOT the world scene —
 * otherwise the world transform pushes the members off-screen («block disappears» on HOME/Shift+1)
 * or the selection filter over top-level world entities comes back empty («F» does nothing).
 *
 * These tests pin the two decisions with the REAL SSoT functions (no mocks): the whole-block extents
 * (HOME/Shift+1/ruler/enter) and the fit-to-selection bounds («F»/«Z»).
 */

const layer = (id: string): SceneLayer =>
  ({ id, name: 'L', color: '#fff', visible: true, locked: false } as SceneLayer);

const memberLine = (id: string, sx: number, sy: number, ex: number, ey: number): Entity =>
  ({ id, type: 'line', layerId: 'lyr1', start: { x: sx, y: sy }, end: { x: ex, y: ey } } as unknown as Entity);

/** A block placed FAR from origin (5000,9000) — so world vs block-local bounds are unmistakably distinct. */
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

describe('ADR-641 — HOME/Shift+1 whole-block zoom-extents scope', () => {
  it('while a block is entered, the fit bounds are the block-LOCAL extents, not the world bounds', () => {
    const bounds = resolveBlockEditScene(worldScene(), 'blk1')?.bounds;
    // Block-local (base @ origin), NOT the world { max: 5010, 9020 } that would blank the canvas.
    expect(bounds?.min).toEqual({ x: 0, y: 0 });
    expect(bounds?.max).toEqual({ x: 10, y: 20 });
  });

  it('at the top level (no active block) the fit bounds stay the world scene bounds', () => {
    const scene = worldScene();
    expect(resolveBlockEditScene(scene, null)).toBe(scene);
    expect(scene.bounds.max).toEqual({ x: 5010, y: 9020 });
  });
});

describe('ADR-641 — «F»/«Z» fit-to-selection scope', () => {
  const selectionBounds = (scene: SceneModel | null, selected: Set<string>) =>
    calculateCombinedEntityBounds(
      ((scene?.entities ?? []) as AnySceneEntity[]).filter((e) => selected.has(e.id)),
    );

  it('the OLD world-scene filter finds NO member (members are not top-level) → null → no fit', () => {
    // Reproduces the bug: a selected member id is not present among the world scene's top-level
    // entities, so the filter is empty and there is nothing to fit.
    const selected = new Set(['m0']);
    expect(selectionBounds(worldScene(), selected)).toBeNull();
  });

  it('the effective (block-local) scene filter finds the member → its LOCAL bounds', () => {
    const selected = new Set(['m0']);
    const effective = resolveBlockEditScene(worldScene(), 'blk1');
    expect(selectionBounds(effective, selected)).toEqual({
      min: { x: 0, y: 0 },
      max: { x: 10, y: 0 },
    });
  });

  it('outside the editor, the effective scene equals the world scene → top-level selection still fits', () => {
    const selected = new Set(['w0']);
    const effective = resolveBlockEditScene(worldScene(), null);
    expect(selectionBounds(effective, selected)).toEqual({
      min: { x: 0, y: 0 },
      max: { x: 1, y: 0 },
    });
  });
});
