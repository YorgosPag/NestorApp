/**
 * ADR-539 Φ3f — FaceContextMenuStore tests (open/close + copy/paste clipboard).
 */

import { useFaceContextMenuStore } from '../FaceContextMenuStore';

afterEach(() => {
  // full reset (hide + clear clipboard) between tests
  useFaceContextMenuStore.getState().hide();
  useFaceContextMenuStore.getState().setClipboard(null);
});

describe('FaceContextMenuStore', () => {
  it('show() opens the menu anchored at the target face + screen point', () => {
    useFaceContextMenuStore.getState().show({ bimId: 'col-1', faceKey: 'side:2' }, { x: 120, y: 80 });
    const s = useFaceContextMenuStore.getState();
    expect(s.open).toBe(true);
    expect(s.target).toEqual({ bimId: 'col-1', faceKey: 'side:2' });
    expect(s.screen).toEqual({ x: 120, y: 80 });
  });

  it('hide() closes the menu but KEEPS the clipboard (copy survives close)', () => {
    useFaceContextMenuStore.getState().setClipboard({ colorHex: '#C0392B' });
    useFaceContextMenuStore.getState().show({ bimId: 'b', faceKey: 'top' }, { x: 0, y: 0 });
    useFaceContextMenuStore.getState().hide();
    const s = useFaceContextMenuStore.getState();
    expect(s.open).toBe(false);
    expect(s.target).toBeNull();
    expect(s.screen).toBeNull();
    expect(s.clipboard).toEqual({ colorHex: '#C0392B' }); // clipboard persists
  });

  it('setClipboard() stores then clears the copied appearance', () => {
    useFaceContextMenuStore.getState().setClipboard({ materialId: 'paint-red' });
    expect(useFaceContextMenuStore.getState().clipboard).toEqual({ materialId: 'paint-red' });
    useFaceContextMenuStore.getState().setClipboard(null);
    expect(useFaceContextMenuStore.getState().clipboard).toBeNull();
  });
});
