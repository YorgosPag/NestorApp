import { IdleDetector } from '../lighting/idle-detector';
import type { QualityModulator } from '../lighting/quality-modulator';
import type { SSAOModulator } from '../lighting/ssao-modulator';
import type { BimSceneLayer } from './BimSceneLayer';
import type { PathTracerRenderer } from '../render/PathTracerRenderer';
import { useViewMode3DStore } from '../stores/ViewMode3DStore';
import { useEnvironmentStore } from '../stores/EnvironmentStore';

export function createSceneIdleDetector(deps: {
  qualityModulator: QualityModulator;
  ssaoModulator: SSAOModulator;
  bimLayer: BimSceneLayer;
  pathTracerRenderer: PathTracerRenderer;
}): IdleDetector {
  return new IdleDetector({
    thresholdMs: 800,
    onIdle: () => {
      deps.qualityModulator.onCameraIdle();
      deps.ssaoModulator.onCameraIdle();
      // ADR-366 — the auto idle photorealism preview is opt-in (default OFF). When
      // disabled, idle keeps the light SSAO refine-on-idle pass and never kicks the
      // path tracer, so ordinary editing never grinds on every camera pause.
      if (!useViewMode3DStore.getState().autoPreviewEnabled) return;
      const hasBimMesh = deps.bimLayer.hasMesh;
      const hdriLoaded = useEnvironmentStore.getState().hdriUrl !== null;
      if (hasBimMesh && hdriLoaded) deps.pathTracerRenderer.start();
      useViewMode3DStore.getState().enterPreviewMode();
    },
    onActive: () => {
      deps.qualityModulator.onCameraActive();
      deps.ssaoModulator.onCameraActive();
      deps.pathTracerRenderer.cancel();
      useViewMode3DStore.getState().enterRasterMode();
    },
  });
}
