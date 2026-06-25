/**
 * ADR-510 Φ3c — `SetBulgeCommand` tests.
 *
 * Covers the Convert-to-Arc / Convert-to-Line / live-drag command: execute/undo
 * sets `bulges[segIndex]` index-aligned with vertices, and the drag-merge gate
 * mirrors `MoveVertexCommand` (only live-drag samples coalesce).
 */
import { SetBulgeCommand } from '../SetBulgeCommand';
import type { ISceneManager, SceneEntity } from '../../interfaces';
import { createMockSceneManager } from '../../__tests__/mock-scene-manager';

interface TestPoly {
  id: string;
  type: 'polyline';
  vertices: Array<{ x: number; y: number }>;
  closed: boolean;
  bulges?: number[];
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

const square = (): TestPoly => ({
  id: 'p1',
  type: 'polyline',
  vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }],
  closed: true,
  bulges: [0, 0, 0, 0],
});

describe('SetBulgeCommand execute/undo/redo', () => {
  it('sets the target segment bulge on execute and restores on undo', () => {
    const { sm, poly } = makeSceneManager(square());
    const cmd = new SetBulgeCommand('p1', 0, 0, 0.5, sm);
    cmd.execute();
    expect(poly.bulges).toEqual([0.5, 0, 0, 0]);
    cmd.undo();
    expect(poly.bulges).toEqual([0, 0, 0, 0]);
    cmd.redo();
    expect(poly.bulges).toEqual([0.5, 0, 0, 0]);
  });

  it('convert-to-line sets the segment bulge to 0 and undo restores the arc', () => {
    const { sm, poly } = makeSceneManager({ ...square(), bulges: [0.41, 0, 0, 0] });
    const cmd = new SetBulgeCommand('p1', 0, 0.41, 0, sm);
    cmd.execute();
    expect(poly.bulges?.[0]).toBe(0);
    cmd.undo();
    expect(poly.bulges?.[0]).toBeCloseTo(0.41);
  });

  it('builds a full-length bulges array when the polyline carries none', () => {
    const poly: TestPoly = { ...square(), bulges: undefined };
    const { sm } = makeSceneManager(poly);
    new SetBulgeCommand('p1', 2, 0, 1, sm).execute();
    expect(poly.bulges).toEqual([0, 0, 1, 0]);
  });

  it('rejects an out-of-range segment index (no mutation)', () => {
    const { sm, poly } = makeSceneManager(square());
    new SetBulgeCommand('p1', 9, 0, 0.5, sm).execute();
    expect(poly.bulges).toEqual([0, 0, 0, 0]);
  });
});

describe('SetBulgeCommand.canMergeWith (ADR-507 §8 drag gate)', () => {
  const sm = {} as unknown as ISceneManager;
  const cmd = (isDragging: boolean, seg = 0, entityId = 'p1') =>
    new SetBulgeCommand(entityId, seg, 0, 0.5, sm, isDragging);

  it('does NOT merge two distinct (non-drag) edits of the same segment', () => {
    expect(cmd(false).canMergeWith(cmd(false))).toBe(false);
  });

  it('merges two live-drag samples of the same segment', () => {
    expect(cmd(true).canMergeWith(cmd(true))).toBe(true);
  });

  it('does NOT merge different segments even while dragging', () => {
    expect(cmd(true, 0).canMergeWith(cmd(true, 1))).toBe(false);
  });

  it('keeps the original old bulge after merge (undo returns to start)', () => {
    const first = new SetBulgeCommand('p1', 0, 0, 0.3, sm, true);
    const second = new SetBulgeCommand('p1', 0, 0.3, 0.7, sm, true);
    const merged = first.mergeWith(second) as SetBulgeCommand;
    expect(merged.getNewBulge()).toBeCloseTo(0.7);
    expect(merged.canMergeWith(cmd(true))).toBe(true);
  });
});

describe('SetBulgeCommand.validate', () => {
  const sm = {} as unknown as ISceneManager;
  it('rejects empty entity id / negative seg / non-finite bulge', () => {
    expect(new SetBulgeCommand('', 0, 0, 0.5, sm).validate()).not.toBeNull();
    expect(new SetBulgeCommand('p1', -1, 0, 0.5, sm).validate()).not.toBeNull();
    expect(new SetBulgeCommand('p1', 0, 0, Number.NaN, sm).validate()).not.toBeNull();
    expect(new SetBulgeCommand('p1', 0, 0, 0.5, sm).validate()).toBeNull();
  });
});
