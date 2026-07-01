/**
 * Tests — EntityBodyDragStore (body-drag session SSoT).
 */
import { EntityBodyDragStore } from '../EntityBodyDragStore';

describe('EntityBodyDragStore', () => {
  afterEach(() => EntityBodyDragStore.clear());

  it('is idle by default', () => {
    expect(EntityBodyDragStore.getActive()).toBe(false);
    expect(EntityBodyDragStore.getAnchor()).toBeNull();
    expect(EntityBodyDragStore.getEntityIds()).toEqual([]);
    expect(EntityBodyDragStore.isCopy()).toBe(false);
    expect(EntityBodyDragStore.getSession()).toBeNull();
  });

  it('arms a move session (copy=false)', () => {
    EntityBodyDragStore.arm({ anchor: { x: 10, y: 20 }, entityIds: ['a', 'b'], copy: false });
    expect(EntityBodyDragStore.getActive()).toBe(true);
    expect(EntityBodyDragStore.getAnchor()).toEqual({ x: 10, y: 20 });
    expect(EntityBodyDragStore.getEntityIds()).toEqual(['a', 'b']);
    expect(EntityBodyDragStore.isCopy()).toBe(false);
  });

  it('arms a copy session (copy=true)', () => {
    EntityBodyDragStore.arm({ anchor: { x: 0, y: 0 }, entityIds: ['x'], copy: true });
    expect(EntityBodyDragStore.isCopy()).toBe(true);
    expect(EntityBodyDragStore.getSession()).toEqual({
      anchor: { x: 0, y: 0 },
      entityIds: ['x'],
      copy: true,
    });
  });

  it('clear() returns to idle', () => {
    EntityBodyDragStore.arm({ anchor: { x: 1, y: 1 }, entityIds: ['a'], copy: false });
    EntityBodyDragStore.clear();
    expect(EntityBodyDragStore.getActive()).toBe(false);
    expect(EntityBodyDragStore.getSession()).toBeNull();
  });

  it('notifies subscribers on arm and clear (one per transition)', () => {
    const calls: boolean[] = [];
    const unsub = EntityBodyDragStore.subscribe(() => calls.push(EntityBodyDragStore.getActive()));
    EntityBodyDragStore.arm({ anchor: { x: 0, y: 0 }, entityIds: ['a'], copy: false });
    EntityBodyDragStore.clear();
    unsub();
    EntityBodyDragStore.arm({ anchor: { x: 0, y: 0 }, entityIds: ['b'], copy: false });
    expect(calls).toEqual([true, false]); // no notification after unsubscribe
  });

  it('clear() on an idle store does not notify', () => {
    const spy = jest.fn();
    const unsub = EntityBodyDragStore.subscribe(spy);
    EntityBodyDragStore.clear();
    unsub();
    expect(spy).not.toHaveBeenCalled();
  });

  it('ESC keydown cancels an active session', () => {
    EntityBodyDragStore.arm({ anchor: { x: 5, y: 5 }, entityIds: ['a'], copy: true });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(EntityBodyDragStore.getActive()).toBe(false);
  });
});
