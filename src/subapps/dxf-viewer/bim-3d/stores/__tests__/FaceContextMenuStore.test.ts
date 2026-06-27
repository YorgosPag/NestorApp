/**
 * ADR-539 Φ3f — FaceContextMenuStore tests (open/close + copy/paste clipboard).
 */

import { useFaceContextMenuStore } from '../FaceContextMenuStore';

afterEach(() => {
  // full reset (hide + clear both clipboards) between tests
  useFaceContextMenuStore.getState().hide();
  useFaceContextMenuStore.getState().setClipboard(null);
  useFaceContextMenuStore.getState().setEntityClipboard(null);
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

  it('setEntityClipboard() stores then clears the entity-level map (Φ4a)', () => {
    const map = { top: { materialId: 'paint-red' }, bottom: { colorHex: '#000000' } };
    useFaceContextMenuStore.getState().setEntityClipboard(map);
    expect(useFaceContextMenuStore.getState().entityClipboard).toEqual(map);
    useFaceContextMenuStore.getState().setEntityClipboard(null);
    expect(useFaceContextMenuStore.getState().entityClipboard).toBeNull();
  });

  it('per-face and entity clipboards are independent slots', () => {
    useFaceContextMenuStore.getState().setClipboard({ colorHex: '#C0392B' });
    useFaceContextMenuStore.getState().setEntityClipboard({ top: { materialId: 'paint-blue' } });
    expect(useFaceContextMenuStore.getState().clipboard).toEqual({ colorHex: '#C0392B' });
    expect(useFaceContextMenuStore.getState().entityClipboard).toEqual({ top: { materialId: 'paint-blue' } });
    // clearing one leaves the other intact
    useFaceContextMenuStore.getState().setClipboard(null);
    expect(useFaceContextMenuStore.getState().clipboard).toBeNull();
    expect(useFaceContextMenuStore.getState().entityClipboard).toEqual({ top: { materialId: 'paint-blue' } });
  });

  it('hide() keeps the entity clipboard too (survives close)', () => {
    useFaceContextMenuStore.getState().setEntityClipboard({ top: { colorHex: '#27AE60' } });
    useFaceContextMenuStore.getState().show({ bimId: 'b', faceKey: 'top' }, { x: 0, y: 0 });
    useFaceContextMenuStore.getState().hide();
    expect(useFaceContextMenuStore.getState().entityClipboard).toEqual({ top: { colorHex: '#27AE60' } });
  });
});
