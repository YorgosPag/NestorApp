/**
 * ADR-507 §8 — `MoveVertexCommand` merge-gate tests.
 *
 * Mirrors the transform family: only LIVE-DRAG samples (both `isDragging`)
 * coalesce. Two distinct edits of the same vertex within the time window must
 * stay separate undo steps (the bug this gate fixes).
 */
import { MoveVertexCommand } from '../MoveVertexCommand';
import type { ISceneManager } from '../../interfaces';

const sm = {} as unknown as ISceneManager;
const cmd = (isDragging: boolean, entityId = 'e1', vertexIndex = 0) =>
  new MoveVertexCommand(entityId, vertexIndex, { x: 0, y: 0 }, { x: 1, y: 1 }, sm, isDragging);

describe('MoveVertexCommand.canMergeWith', () => {
  it('does NOT merge two distinct (non-drag) edits of the same vertex', () => {
    expect(cmd(false).canMergeWith(cmd(false))).toBe(false);
  });

  it('does NOT merge when only one side is dragging', () => {
    expect(cmd(true).canMergeWith(cmd(false))).toBe(false);
    expect(cmd(false).canMergeWith(cmd(true))).toBe(false);
  });

  it('merges two live-drag samples of the same vertex within the window', () => {
    expect(cmd(true).canMergeWith(cmd(true))).toBe(true);
  });

  it('does NOT merge different vertices even while dragging', () => {
    expect(cmd(true, 'e1', 0).canMergeWith(cmd(true, 'e1', 1))).toBe(false);
  });

  it('does NOT merge different entities even while dragging', () => {
    expect(cmd(true, 'e1', 0).canMergeWith(cmd(true, 'e2', 0))).toBe(false);
  });

  it('a merged command stays a drag (keeps coalescing further samples)', () => {
    const merged = cmd(true).mergeWith(cmd(true));
    expect(merged.canMergeWith(cmd(true))).toBe(true);
  });
});
