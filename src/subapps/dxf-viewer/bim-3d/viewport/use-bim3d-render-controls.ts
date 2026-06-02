import { useCallback } from 'react';
import type { ThreeJsSceneManager } from '../scene/ThreeJsSceneManager';
import { useViewMode3DStore, type FinalRenderConfig } from '../stores/ViewMode3DStore';
import type { FirebaseAuthUser } from '@/auth/types/auth.types';

interface RenderControlsArgs {
  managerRef: React.MutableRefObject<ThreeJsSceneManager | null>;
  user: FirebaseAuthUser | null;
  projectId: string | null;
}

interface RenderControls {
  handleRenderConfirm: (config: FinalRenderConfig) => void;
  handleRenderCancel: () => void;
  handleCalibrateSample: () => void;
}

/**
 * ADR-366 §B.4 / §B.6 — final-render control callbacks for BimViewport3D.
 *
 * Extracted from BimViewport3D.tsx (Google file-size SSoT, N.7.1): keeps the
 * viewport component a thin ADR-040 leaf while the render-pipeline wiring lives
 * here. No store subscriptions — pure imperative bridge to ThreeJsSceneManager.
 */
export function useBim3DRenderControls({ managerRef, user, projectId }: RenderControlsArgs): RenderControls {
  const handleRenderConfirm = useCallback((config: FinalRenderConfig) => {
    const manager = managerRef.current;
    if (!manager || !user || !projectId) return;
    const store = useViewMode3DStore.getState();
    store.startFinalRender(config);
    manager.startFinalRender(
      config,
      { projectId, companyId: user.companyId ?? '', userId: user.uid },
      (pct) => store.updateFinalRenderProgress(pct),
      (result) => {
        store.completeFinalRender();
        if (result.uploadError) {
          // Toast fires from parent app notification — upload error logged silently
          console.warn('[BimViewport3D] render upload failed — fallback disk save applied');
        }
      },
    );
  }, [managerRef, user, projectId]);

  const handleRenderCancel = useCallback(() => {
    managerRef.current?.cancelFinalRender();
    useViewMode3DStore.getState().completeFinalRender();
  }, [managerRef]);

  const handleCalibrateSample = useCallback(() => {
    // No-op: GPU calibration uses its own timed loop inside render-cost-estimator.
    // PathTracerRenderer.renderSample() is only called from the RAF loop.
    // We use performance.now() inside calibrateGpu with a lightweight JS loop.
  }, []);

  return { handleRenderConfirm, handleRenderCancel, handleCalibrateSample };
}
