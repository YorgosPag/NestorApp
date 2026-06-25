/**
 * ADR-510 Φ3c — `PolylineVertexCommand` keeps per-segment parallel arrays
 * (`bulges` / `startWidths` / `endWidths`) index-aligned with `vertices` across
 * add / remove edits, so an arc/width-bearing polyline survives vertex editing.
 */
import { PolylineVertexCommand } from '../PolylineVertexCommand';
import type { SceneEntity } from '../../interfaces';
import { createMockSceneManager } from '../../__tests__/mock-scene-manager';

interface TestPoly {
  id: string;
  type: 'polyline';
  vertices: Array<{ x: number; y: number }>;
  closed: boolean;
  bulges?: number[];
  startWidths?: number[];
  endWidths?: number[];
}

function makeSceneManager(poly: TestPoly): { sm: ReturnType<typeof createMockSceneManager>; poly: TestPoly } {
  const sm = createMockSceneManager([poly as unknown as SceneEntity], {
    // TRAP 2: tests read `poly` local reference after updateEntity — must mutate in place
    updateEntity: (_id: string, updates: Partial<SceneEntity>) => {
      if (_id === poly.id) Object.assign(poly, updates);
    },
  });
  return { sm, poly };
}

const base = (): TestPoly => ({
  id: 'p1',
  type: 'polyline',
  vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }],
  closed: true,
  bulges: [0.5, 0, 0, 0],
  startWidths: [1, 2, 3, 4],
  endWidths: [5, 6, 7, 8],
});

describe('PolylineVertexCommand parallel-array reindex', () => {
  it('add inserts a 0 entry into every parallel array at the same index', () => {
    const { sm, poly } = makeSceneManager(base());
    const cmd = new PolylineVertexCommand(
      { entityId: 'p1', op: { kind: 'add', index: 1, position: { x: 5, y: 0 } } },
      sm,
    );
    cmd.execute();
    expect(poly.vertices).toHaveLength(5);
    expect(poly.bulges).toEqual([0.5, 0, 0, 0, 0]);
    expect(poly.startWidths).toEqual([1, 0, 2, 3, 4]);
    expect(poly.endWidths).toEqual([5, 0, 6, 7, 8]);
  });

  it('undo restores the original vertex + parallel arrays', () => {
    const { sm, poly } = makeSceneManager(base());
    const cmd = new PolylineVertexCommand(
      { entityId: 'p1', op: { kind: 'add', index: 1, position: { x: 5, y: 0 } } },
      sm,
    );
    cmd.execute();
    cmd.undo();
    expect(poly.vertices).toHaveLength(4);
    expect(poly.bulges).toEqual([0.5, 0, 0, 0]);
    expect(poly.startWidths).toEqual([1, 2, 3, 4]);
  });

  it('remove drops the removed vertex outgoing entry from every parallel array', () => {
    const { sm, poly } = makeSceneManager(base());
    new PolylineVertexCommand({ entityId: 'p1', op: { kind: 'remove', index: 1 } }, sm).execute();
    expect(poly.vertices).toHaveLength(3);
    expect(poly.bulges).toEqual([0.5, 0, 0]);
    expect(poly.startWidths).toEqual([1, 3, 4]);
    expect(poly.endWidths).toEqual([5, 7, 8]);
  });

  it('refuses to remove below 2 vertices (no mutation)', () => {
    const poly: TestPoly = { ...base(), vertices: [{ x: 0, y: 0 }, { x: 1, y: 1 }], bulges: [0], startWidths: [1], endWidths: [2] };
    const { sm } = makeSceneManager(poly);
    new PolylineVertexCommand({ entityId: 'p1', op: { kind: 'remove', index: 0 } }, sm).execute();
    expect(poly.vertices).toHaveLength(2);
  });

  it('leaves a plain polyline (no parallel arrays) working', () => {
    const poly: TestPoly = { id: 'p1', type: 'polyline', vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], closed: true };
    const { sm } = makeSceneManager(poly);
    new PolylineVertexCommand({ entityId: 'p1', op: { kind: 'add', index: 1, position: { x: 5, y: 0 } } }, sm).execute();
    expect(poly.vertices).toHaveLength(4);
    expect(poly.bulges).toBeUndefined();
  });
});
