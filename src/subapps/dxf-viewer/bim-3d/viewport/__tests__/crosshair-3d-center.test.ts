/**
 * Tests for crosshair-3d-center — the snap-vs-cursor decision SSoT (ADR-545).
 * (Snap visibility — on-screen/occlusion/camera-motion — is decided + tested in
 * project-snap3d-marker; here the snap point is already validated/projected.)
 */

import { resolveCrosshair3DCenter } from '../crosshair-3d-center';

const CURSOR = { x: 100, y: 200 };
const SNAP = { x: 300, y: 400 };

describe('resolveCrosshair3DCenter', () => {
  it('jumps to the snap point (snapped=true) when one is available', () => {
    expect(resolveCrosshair3DCenter({ cursor: CURSOR, snapProjected: SNAP }))
      .toEqual({ point: SNAP, snapped: true });
  });

  it('follows the cursor (snapped=false) when there is no snap', () => {
    expect(resolveCrosshair3DCenter({ cursor: CURSOR, snapProjected: null }))
      .toEqual({ point: CURSOR, snapped: false });
  });

  it('prefers the snap point over the cursor when both exist', () => {
    expect(resolveCrosshair3DCenter({ cursor: CURSOR, snapProjected: SNAP }).point).toBe(SNAP);
  });

  it('hides (point=null) when both snap and cursor are unavailable', () => {
    expect(resolveCrosshair3DCenter({ cursor: null, snapProjected: null }))
      .toEqual({ point: null, snapped: false });
  });
});
