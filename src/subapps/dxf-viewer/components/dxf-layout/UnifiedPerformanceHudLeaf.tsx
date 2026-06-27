'use client';

/**
 * UnifiedPerformanceHudLeaf — ADR-366 §B.5.U / ADR-040 micro-leaf.
 *
 * Single mount point for the Performance HUD that lives in BOTH the 2D Canvas2D
 * viewport and the 3D WebGL viewport (mounted as a sibling of
 * CanvasLayerStack3dLeaf inside CanvasLayerStack, which renders in both modes).
 *
 * Runs the mode bridge (drives the 2D collector + mirrors the active mode into
 * PerformanceHUDStore.renderMode) and renders the shared <PerformanceHUD/>.
 * Resolves the screenshot/diagnostic canvas per mode:
 *   - '2d'  → the live dxf Canvas2D (via getCanvas2D)
 *   - 3D    → the three.js renderer canvas (active-scene-manager registry, ADR-453)
 *
 * ADR-040: only low-freq subscriptions (mode + auth/hierarchy) — the HUD itself
 * is a 1-subscriber micro-leaf.
 */

import { useAuth } from '@/auth/hooks/useAuth';
import { useProjectHierarchyOptional } from '../../contexts/ProjectHierarchyContext';
import { PerformanceHUD } from '../../bim-3d/performance/PerformanceHUD';
import { usePerformanceModeBridge } from '../../bim-3d/performance/usePerformanceModeBridge';
import { getActiveSceneManager } from '../../bim-3d/scene/active-scene-manager-registry';

interface UnifiedPerformanceHudLeafProps {
  /** Resolves the live 2D dxf canvas element (for screenshots in 2D mode). */
  getCanvas2D: () => HTMLCanvasElement | null;
}

export function UnifiedPerformanceHudLeaf({ getCanvas2D }: UnifiedPerformanceHudLeafProps) {
  const mode = usePerformanceModeBridge();
  const { user } = useAuth();
  const hierarchy = useProjectHierarchyOptional();
  const projectId = hierarchy?.selectedProject?.id ?? null;

  const canvas = mode === '2d'
    ? getCanvas2D()
    : getActiveSceneManager()?.getRendererCanvas() ?? null;

  return (
    <PerformanceHUD
      canvas={canvas}
      projectId={projectId}
      userId={user?.uid ?? null}
      companyId={user?.companyId ?? null}
    />
  );
}
