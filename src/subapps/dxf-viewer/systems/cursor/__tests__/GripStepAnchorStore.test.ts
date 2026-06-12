/**
 * Tests for GripStepAnchorStore — the drag-anchor SSoT that drives the crosshair
 * snap-to-grid (AutoCAD F9 parity) during a 2D grip drag (ADR-363).
 */
import {
  setGripStepAnchor,
  clearGripStepAnchor,
  getGripStepAnchor,
} from '../GripStepAnchorStore';

describe('GripStepAnchorStore', () => {
  afterEach(() => clearGripStepAnchor());

  it('starts empty (no anchor outside a drag)', () => {
    expect(getGripStepAnchor()).toBeNull();
  });

  it('stores and returns the published anchor', () => {
    setGripStepAnchor({ x: 1200, y: -350 });
    expect(getGripStepAnchor()).toEqual({ x: 1200, y: -350 });
  });

  it('clear resets to null (drag end / reset)', () => {
    setGripStepAnchor({ x: 5, y: 5 });
    clearGripStepAnchor();
    expect(getGripStepAnchor()).toBeNull();
  });

  it('last write wins (idempotent per-frame republish keeps the constant anchor)', () => {
    setGripStepAnchor({ x: 10, y: 10 });
    setGripStepAnchor({ x: 10, y: 10 });
    expect(getGripStepAnchor()).toEqual({ x: 10, y: 10 });
  });
});
