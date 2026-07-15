import { IdleDetector } from '../lighting/idle-detector';
import type { QualityModulator } from '../lighting/quality-modulator';
import type { SSAOModulator } from '../lighting/ssao-modulator';
import type { BimSceneLayer } from './BimSceneLayer';
import type { PathTracerRenderer } from '../render/PathTracerRenderer';
import { useViewMode3DStore } from '../stores/ViewMode3DStore';
import { useEnvironmentStore } from '../stores/EnvironmentStore';
import { getTerrain3DState } from '../../systems/topography/terrain-3d-store';
import { getPointCloud3DState } from '../../systems/topography/pointcloud-3d-store';
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
      // ADR-366 — the shadow-quality RESTORE is the cheap, one-shot COUNTERPART of the
      // always-on `onCameraActive()` degrade (soft shadows 2048/r4 ⇄ moving 1024/r0.5). It
      // must run on EVERY idle, decoupled from `autoPreviewEnabled` — otherwise the degrade
      // fires on every camera move but the restore never does, so shadows stay stuck at the
      // sharp/low moving-quality during ordinary editing (asymmetry bug). It is NOT the grind
      // culprit: it only rebuilds the shadow map once on settle (on-demand), it never re-renders
      // per frame the way the SSAO composer pass does.
      deps.qualityModulator.onCameraIdle();

      // ADR-366 — the EXPENSIVE idle escalation stays opt-in via `autoPreviewEnabled` (default
      // OFF): the SSAO refine-on-idle composer pass (the heavy per-frame FBO round-trip that
      // kept "doing photorealism" on every stop), the photorealism path tracer AND preview mode.
      // When OFF the idle leaves the fast interaction raster untouched, so the machine never
      // grinds on a camera pause during ordinary editing.
      if (!useViewMode3DStore.getState().autoPreviewEnabled) return;
      deps.ssaoModulator.onCameraIdle();

      // ADR-650 M10c — the survey terrain / point cloud are a SURVEY-analysis workflow, not a
      // photoreal subject, so the idle path tracer must NOT engage while they are shown: (1) an
      // analysis colour ramp is not a BSDF — path tracing it is meaningless (Revit/Civil 3D analysis
      // styles are display-only and never appear in a rendered/ray-traced view); (2) belt-and-braces,
      // the path tracer's three-mesh-bvh MERGE wants a uniform attribute set across every scene mesh,
      // and the analysis terrain carries a per-vertex `color` attribute no BIM solid has. So while
      // topo is visible we stay in refined raster (SSAO already applied above).
      if (getTerrain3DState().visible || getPointCloud3DState().visible) return;

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
