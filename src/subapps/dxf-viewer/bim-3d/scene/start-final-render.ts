// ============================================================================
// START FINAL RENDER — path-traced final render + output writer wiring.
// Extracted from ThreeJsSceneManager (ADR-366 Phase 4.5) to keep the manager
// class under the 500-line cap. Pure orchestrator: no class state, no React.
// ============================================================================

import type { PathTracerRenderer } from '../render/PathTracerRenderer';
import type { FinalRenderConfig } from '../stores/ViewMode3DStore';
import { writeRenderOutput } from '../render/render-output-writer';

export interface FinalRenderContext {
  readonly projectId: string;
  readonly companyId: string;
  readonly userId: string;
}

export interface FinalRenderResult {
  readonly savedDisk: boolean;
  readonly savedProject: boolean;
  readonly uploadError: boolean;
}

export function startFinalRender(
  pathTracer: PathTracerRenderer,
  canvas: HTMLCanvasElement,
  config: FinalRenderConfig,
  ctx: FinalRenderContext,
  onProgress: (pct: number) => void,
  onComplete: (result: FinalRenderResult) => void,
): void {
  pathTracer.cancel();
  pathTracer.invalidateScene();
  pathTracer.startFinal(config, onProgress, () => {
    writeRenderOutput(canvas, {
      format: config.format,
      destDisk: config.destDisk,
      destProject: config.destProject,
      projectId: ctx.projectId,
      companyId: ctx.companyId,
      userId: ctx.userId,
      presetSPP: config.presetSPP,
      resolutionW: config.resolutionW,
      resolutionH: config.resolutionH,
    })
      .then(onComplete)
      .catch(() => {
        onComplete({ savedDisk: false, savedProject: false, uploadError: true });
      });
  });
}
