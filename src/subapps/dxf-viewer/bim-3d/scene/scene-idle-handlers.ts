import { IdleDetector } from '../lighting/idle-detector';
import type { QualityModulator } from '../lighting/quality-modulator';
import type { SSAOModulator } from '../lighting/ssao-modulator';
import type { BimSceneLayer } from './BimSceneLayer';
import type { PathTracerRenderer } from '../render/PathTracerRenderer';
import { useViewMode3DStore } from '../stores/ViewMode3DStore';
import { useEnvironmentStore } from '../stores/EnvironmentStore';
import { DXF_TIMING } from '../../config/dxf-timing';

export function createSceneIdleDetector(deps: {
  qualityModulator: QualityModulator;
  ssaoModulator: SSAOModulator;
  bimLayer: BimSceneLayer;
  pathTracerRenderer: PathTracerRenderer;
}): IdleDetector {
  return new IdleDetector({
    thresholdMs: DXF_TIMING.gesture.CAMERA_IDLE, // ADR-516
    onIdle: () => {
      // ADR-366 — ALL idle quality escalation is opt-in via `autoPreviewEnabled`
      // (default OFF): the SSAO refine-on-idle composer pass, the render-quality
      // bump AND the photorealism path tracer. When OFF the idle leaves the fast
      // interaction raster untouched, so the machine never re-renders / grinds on a
      // camera pause during ordinary editing (the SSAO composer pass alone — heavy
      // FBO round-trip — was what kept "doing photorealism" on every stop).
      if (!useViewMode3DStore.getState().autoPreviewEnabled) return;
      deps.qualityModulator.onCameraIdle();
      deps.ssaoModulator.onCameraIdle();
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
