/**
 * ADR-366 §3D — DXF overlay first-frame camera fit.
 *
 * Extracted from `ThreeJsSceneManager.syncDxfOverlay` to keep the manager
 * file under the 500-line cap (Google SRP, CLAUDE.md N.7.1).
 */

import type { ViewportCamera } from '../viewport/viewport-types';

export interface DxfOverlayFramingContext {
  readonly viewport: ViewportCamera;
  readonly bounds: import('three').Box3 | null;
  readonly fitDone: boolean;
  readonly onFitApplied: () => void;
}

export function applyDxfOverlayFraming(ctx: DxfOverlayFramingContext): void {
  const { bounds, fitDone, viewport, onFitApplied } = ctx;
  if (fitDone) return;
  if (!bounds || bounds.isEmpty()) return;
  viewport.frameBounds(bounds.min, bounds.max);
  onFitApplied();
}
