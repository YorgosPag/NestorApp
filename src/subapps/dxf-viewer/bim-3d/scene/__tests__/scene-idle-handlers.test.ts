/**
 * ADR-366 — idle photorealism preview gate.
 *
 * The auto idle path-trace preview is opt-in (default OFF). When disabled, an idle
 * period must keep the light SSAO refine-on-idle handlers but NEVER start the path
 * tracer (which would grind the machine on every camera pause). When enabled (and a
 * BIM mesh + HDRI are present), idle starts the path tracer as before.
 */

import { createSceneIdleDetector } from '../scene-idle-handlers';
import { useViewMode3DStore } from '../../stores/ViewMode3DStore';
import { useEnvironmentStore } from '../../stores/EnvironmentStore';
import type { QualityModulator } from '../../lighting/quality-modulator';
import type { SSAOModulator } from '../../lighting/ssao-modulator';
import type { BimSceneLayer } from '../BimSceneLayer';
import type { PathTracerRenderer } from '../../render/PathTracerRenderer';

const THRESHOLD_MS = 800;

function makeDeps() {
  const start = jest.fn();
  const deps = {
    qualityModulator: { onCameraIdle: jest.fn(), onCameraActive: jest.fn() } as unknown as QualityModulator,
    ssaoModulator: { onCameraIdle: jest.fn(), onCameraActive: jest.fn() } as unknown as SSAOModulator,
    bimLayer: { hasMesh: true } as unknown as BimSceneLayer,
    pathTracerRenderer: { start, cancel: jest.fn() } as unknown as PathTracerRenderer,
  };
  return { deps, start };
}

describe('createSceneIdleDetector — auto-preview gate', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    useViewMode3DStore.setState({ mode: '3d-raster', autoPreviewEnabled: false });
    useEnvironmentStore.getState().setHdriUrl('test-hdri');
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    useEnvironmentStore.getState().setHdriUrl(null);
  });

  it('restores shadow quality on idle but skips the EXPENSIVE escalation (path tracer + SSAO) when auto-preview is OFF', () => {
    const { deps, start } = makeDeps();
    const detector = createSceneIdleDetector(deps);

    detector.notifyIdle();
    jest.advanceTimersByTime(THRESHOLD_MS);

    // OFF → the cheap shadow-quality RESTORE still runs (symmetric with the always-on degrade,
    // else shadows stay stuck at moving-quality during ordinary editing)...
    expect(deps.qualityModulator.onCameraIdle).toHaveBeenCalledTimes(1);
    // ...but the expensive idle escalation is skipped: no path-trace, no SSAO composer pass.
    expect(start).not.toHaveBeenCalled();
    expect(deps.ssaoModulator.onCameraIdle).not.toHaveBeenCalled();
    detector.dispose();
  });

  it('starts the path tracer on idle when auto-preview is ON (mesh + HDRI present)', () => {
    useViewMode3DStore.setState({ autoPreviewEnabled: true });
    const { deps, start } = makeDeps();
    const detector = createSceneIdleDetector(deps);

    detector.notifyIdle();
    jest.advanceTimersByTime(THRESHOLD_MS);

    expect(start).toHaveBeenCalledTimes(1);
    expect(useViewMode3DStore.getState().mode).toBe('3d-preview');
    detector.dispose();
  });
});
