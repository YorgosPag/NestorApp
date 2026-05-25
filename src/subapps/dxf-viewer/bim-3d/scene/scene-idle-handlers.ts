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
      // NOTE: ssaoModulator.onCameraIdle() disabled — SSAO corrupts scene when
      // LineSegments (DXF wireframe) mix with BIM meshes (garbage normal buffer
      // for line geometry → SSAOPass output goes black). Re-enable only after
      // a lines-exclusion fix or pure-BIM detection is in place.
      const hasBimMesh = deps.bimLayer.hasAnyMesh();
      const hdriLoaded = useEnvironmentStore.getState().hdriUrl !== null;
      console.log('[3D-DEBUG][onIdle] hasBimMesh:', hasBimMesh, 'hdriLoaded:', hdriLoaded, 'ssao:DISABLED');
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
