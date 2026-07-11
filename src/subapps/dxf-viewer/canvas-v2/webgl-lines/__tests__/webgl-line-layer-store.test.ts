/**
 * ADR-639 Στάδιο 5 — activation-store behaviour: getter, idempotent toggle, listener
 * notification, and the markSystemsDirty(['dxf-canvas']) side-effect on real changes.
 * The frame scheduler is mocked so the test stays pure. N.17-safe (jest only).
 */

jest.mock('../../../rendering/core/frame-scheduler-api', () => ({
  markSystemsDirty: jest.fn(),
}));

import {
  isWebglLineLayerActive,
  setWebglLineLayerActive,
  subscribeWebglLineLayerActive,
  WEBGL_LINE_CANVAS_SYSTEM_ID,
} from '../webgl-line-layer-store';
import { markSystemsDirty } from '../../../rendering/core/frame-scheduler-api';

const dirty = markSystemsDirty as jest.MockedFunction<typeof markSystemsDirty>;

afterEach(() => {
  setWebglLineLayerActive(false); // reset module singleton
  dirty.mockClear();
});

describe('webgl-line-layer-store', () => {
  it('exposes the canvas system id', () => {
    expect(WEBGL_LINE_CANVAS_SYSTEM_ID).toBe('webgl-line-canvas');
  });

  it('starts inactive and toggles', () => {
    expect(isWebglLineLayerActive()).toBe(false);
    setWebglLineLayerActive(true);
    expect(isWebglLineLayerActive()).toBe(true);
  });

  it('marks the dxf-canvas dirty on a real change and notifies listeners', () => {
    const seen: boolean[] = [];
    const unsub = subscribeWebglLineLayerActive(() => seen.push(isWebglLineLayerActive()));
    setWebglLineLayerActive(true);
    expect(dirty).toHaveBeenCalledWith(['dxf-canvas']);
    expect(seen).toEqual([true]);
    unsub();
  });

  it('is idempotent — no dirty / no notify when unchanged', () => {
    setWebglLineLayerActive(true);
    dirty.mockClear();
    const listener = jest.fn();
    const unsub = subscribeWebglLineLayerActive(listener);
    setWebglLineLayerActive(true); // same value
    expect(dirty).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
    unsub();
  });

  it('stops notifying after unsubscribe', () => {
    const listener = jest.fn();
    const unsub = subscribeWebglLineLayerActive(listener);
    unsub();
    setWebglLineLayerActive(true);
    expect(listener).not.toHaveBeenCalled();
  });
});
