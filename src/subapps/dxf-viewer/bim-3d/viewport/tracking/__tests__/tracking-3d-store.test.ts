/**
 * ADR-543 (COL traces 3D) — tracking-3d-store: non-reactive payload bridge (zero React).
 * Written by `use-bim3d-wall-placement`, read by `Tracking3DOverlay`'s RAF loop.
 */

import { tracking3DData, setTracking3D, clearTracking3D, type Tracking3DPayload } from '../tracking-3d-store';

const PAYLOAD: Tracking3DPayload = {
  paths: [{ origin: { x: 0, y: 0 }, dx: 1, dy: 0, angleDeg: 0 }],
  intersections: [{ x: 100, y: 0 }],
  markers: [],
  snappedPoint: { x: 50, y: 0 },
  label: '0° / 50mm',
};

describe('tracking-3d-store', () => {
  afterEach(() => clearTracking3D());

  it('starts empty', () => {
    expect(tracking3DData.payload).toBeNull();
  });

  it('setTracking3D writes payload + elevation + units', () => {
    setTracking3D(PAYLOAD, 3000, 'm');
    expect(tracking3DData.payload).toBe(PAYLOAD);
    expect(tracking3DData.floorElevationMm).toBe(3000);
    expect(tracking3DData.sceneUnits).toBe('m');
  });

  it('setTracking3D(null) clears the payload but keeps elev/units for the frame', () => {
    setTracking3D(PAYLOAD, 3000, 'm');
    setTracking3D(null, 3000, 'm');
    expect(tracking3DData.payload).toBeNull();
  });

  it('clearTracking3D nulls the payload', () => {
    setTracking3D(PAYLOAD, 1000, 'mm');
    clearTracking3D();
    expect(tracking3DData.payload).toBeNull();
  });
});
