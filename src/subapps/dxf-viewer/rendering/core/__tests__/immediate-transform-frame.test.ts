/**
 * immediate-transform-frame — SSoT "repaint in sync with the panning canvas" tests.
 *
 * The scheduler + immediate-transform store are mocked so we can assert the wiring without a
 * real RAF: a LOW-priority subsystem is registered, `onFrame` fires once initially + on every
 * scheduler tick, and the dirty-check fires exactly once per transform change.
 */

const mockTransformState = { value: { scale: 1, offsetX: 0, offsetY: 0 } };
const mockUnregister = jest.fn();

jest.mock('../../../systems/cursor/ImmediateTransformStore', () => ({
  getImmediateTransform: () => mockTransformState.value,
}));
jest.mock('../UnifiedFrameScheduler', () => ({
  UnifiedFrameScheduler: { register: jest.fn(() => mockUnregister) },
  RENDER_PRIORITIES: { LOW: 'low', NORMAL: 'normal', HIGH: 'high' },
}));

import {
  immediateTransformSignature,
  subscribeImmediateTransformFrame,
} from '../immediate-transform-frame';
import { UnifiedFrameScheduler, RENDER_PRIORITIES } from '../UnifiedFrameScheduler';

const registerMock = UnifiedFrameScheduler.register as jest.Mock;

beforeEach(() => {
  mockTransformState.value = { scale: 1, offsetX: 0, offsetY: 0 };
  registerMock.mockClear();
  mockUnregister.mockClear();
});

describe('immediateTransformSignature', () => {
  it('reflects the live immediate transform (scale, offsetX, offsetY)', () => {
    mockTransformState.value = { scale: 2, offsetX: 3, offsetY: 4 };
    expect(immediateTransformSignature()).toBe('2,3,4');
  });
});

describe('subscribeImmediateTransformFrame', () => {
  it('registers a LOW-priority subsystem with the given id/name and returns the unregister fn', () => {
    const stop = subscribeImmediateTransformFrame('ghost-x', 'Ghost X', jest.fn());
    expect(registerMock).toHaveBeenCalledTimes(1);
    const [id, name, priority] = registerMock.mock.calls[0];
    expect(id).toBe('ghost-x');
    expect(name).toBe('Ghost X');
    expect(priority).toBe(RENDER_PRIORITIES.LOW);
    expect(stop).toBe(mockUnregister);
  });

  it('paints once immediately on subscribe (and on every re-register)', () => {
    const onFrame = jest.fn();
    subscribeImmediateTransformFrame('ghost', 'Ghost', onFrame);
    expect(onFrame).toHaveBeenCalledTimes(1);
  });

  it('invokes onFrame through the scheduler frame callback', () => {
    const onFrame = jest.fn();
    subscribeImmediateTransformFrame('ghost', 'Ghost', onFrame);
    onFrame.mockClear();
    const frameCb = registerMock.mock.calls[0][3] as () => void;
    frameCb();
    expect(onFrame).toHaveBeenCalledTimes(1);
  });

  it('dirty-check fires once per transform change, then stays clean until the next change', () => {
    subscribeImmediateTransformFrame('ghost', 'Ghost', jest.fn());
    const isDirty = registerMock.mock.calls[0][4] as () => boolean;
    expect(isDirty()).toBe(true); // first observation (sig changed from '')
    expect(isDirty()).toBe(false); // unchanged
    mockTransformState.value = { scale: 2, offsetX: 0, offsetY: 0 };
    expect(isDirty()).toBe(true); // pan/zoom changed
    expect(isDirty()).toBe(false);
  });
});
