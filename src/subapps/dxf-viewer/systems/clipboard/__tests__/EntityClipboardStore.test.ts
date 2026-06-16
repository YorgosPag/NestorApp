/**
 * Tests — Entity Clipboard Store (ADR-466).
 */
import { EntityClipboardStore } from '../EntityClipboardStore';
import type { SceneEntity } from '../../../core/commands/interfaces';

function makeEntity(id: string, x = 0): SceneEntity {
  return { id, type: 'line', params: { start: { x, y: 0 }, end: { x: x + 100, y: 0 } } } as unknown as SceneEntity;
}

describe('EntityClipboardStore', () => {
  afterEach(() => EntityClipboardStore.clear());

  it('starts empty', () => {
    expect(EntityClipboardStore.hasContent()).toBe(false);
    expect(EntityClipboardStore.read()).toEqual([]);
    expect(EntityClipboardStore.sourceFloorId()).toBeNull();
  });

  it('copies entities + source floor and reports content', () => {
    EntityClipboardStore.copy([makeEntity('a'), makeEntity('b')], 'flr_src');
    expect(EntityClipboardStore.hasContent()).toBe(true);
    expect(EntityClipboardStore.read().map((e) => e.id)).toEqual(['a', 'b']);
    expect(EntityClipboardStore.sourceFloorId()).toBe('flr_src');
  });

  it('stores FROZEN deep copies — mutating the source does not leak', () => {
    const src = makeEntity('a', 10);
    EntityClipboardStore.copy([src], 'flr_src');
    (src as unknown as { params: { start: { x: number } } }).params.start.x = 9999;
    const read = EntityClipboardStore.read()[0] as unknown as { params: { start: { x: number } } };
    expect(read.params.start.x).toBe(10);
  });

  it('returns fresh copies on each read (paste cannot corrupt the clipboard)', () => {
    EntityClipboardStore.copy([makeEntity('a')], null);
    const first = EntityClipboardStore.read()[0];
    const second = EntityClipboardStore.read()[0];
    expect(first).not.toBe(second);
  });

  it('copy([]) clears the clipboard', () => {
    EntityClipboardStore.copy([makeEntity('a')], 'f');
    EntityClipboardStore.copy([], 'f');
    expect(EntityClipboardStore.hasContent()).toBe(false);
  });

  it('clear() empties the clipboard', () => {
    EntityClipboardStore.copy([makeEntity('a')], 'f');
    EntityClipboardStore.clear();
    expect(EntityClipboardStore.hasContent()).toBe(false);
  });
});
