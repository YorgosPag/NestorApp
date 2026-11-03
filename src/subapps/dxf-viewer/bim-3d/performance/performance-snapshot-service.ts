/**
 * performance-snapshot-service — ADR-366 §B.5 + §C.7.Q4
 *
 * Client-side SSoT for the diagnostic report: ONE screenshot capture and ONE
 * send path, shared by the manual «Αποστολή στην υποστήριξη» flow (B.5) and the
 * low-FPS prompt (C.7.Q4). The server handles Storage upload (Admin SDK),
 * Firestore write and EntityAuditService audit — clients never write directly
 * to `performance_diagnostics` (see firestore.rules).
 *
 * «What you see is what is sent»: the review dialog shows the data URL from
 * `captureDiagnosticScreenshot()` and `sendDiagnostic()` uploads THAT data URL.
 * There is no second capture, so the report cannot differ from the preview.
 *
 * Sources accepted by the route:
 *   - 'manual'      → user opened the dialog from the HUD (B.5)
 *   - 'auto_submit' → user accepted the low-FPS prompt (C.7.Q4)
 */

import { apiClient } from '@/lib/api/enterprise-api-client';
import type { PerformanceMetricsSnapshot } from './PerformanceHUDStore';
import type { HudRenderMode } from './hud-render-mode';
import { getActiveSceneManager } from '../scene/active-scene-manager-registry';

const SCREENSHOT_TYPE = 'image/png';
const SCREENSHOT_QUALITY = 0.92;

export type DiagnosticSource = 'manual' | 'auto_submit';

export interface DiagnosticInput {
  projectId: string | null;
  metrics: PerformanceMetricsSnapshot;
  renderMode: HudRenderMode;
  /** Data URL produced by `captureDiagnosticScreenshot` — the one the user previewed. */
  screenshotDataUrl: string;
  comment: string;
  source: DiagnosticSource;
}

/**
 * Capture the screenshot for a diagnostic report.
 *
 * 3D: the main renderer runs with `preserveDrawingBuffer:false` (per-frame
 * fill-rate win), so a bare `canvas.toDataURL()` outside the render loop reads
 * a CLEARED buffer — a blank image. The active scene manager force-renders one
 * frame and reads it in the same task. `||` (not `??`): a disposed manager
 * returns '' and must fall back too.
 *
 * 2D: the Canvas2D keeps its pixels, so the canvas itself is the source. The 3D
 * manager is NOT consulted — in 2D it would capture the wrong view.
 */
export function captureDiagnosticScreenshot(
  canvas: HTMLCanvasElement,
  renderMode: HudRenderMode,
): string {
  if (renderMode !== '2d') {
    const frame = getActiveSceneManager()?.captureFrameDataURL(SCREENSHOT_TYPE, SCREENSHOT_QUALITY);
    if (frame) return frame;
  }
  return canvas.toDataURL(SCREENSHOT_TYPE, SCREENSHOT_QUALITY);
}

/**
 * POST the report. Goes through `apiClient`, so it carries an `Idempotency-Key`
 * and a network/5xx retry cannot record the same report twice (ADR-853 Ε3).
 * Throws on failure — the caller owns the user-facing feedback.
 */
export async function sendDiagnostic(input: DiagnosticInput): Promise<void> {
  const { metrics, renderMode, screenshotDataUrl, comment, projectId, source } = input;
  const screenshotBase64 = screenshotDataUrl.split(',')[1] ?? screenshotDataUrl;

  await apiClient.post('/api/performance-diagnostics', {
    projectId,
    metrics,
    renderMode,
    comment: comment || null,
    source,
    screenshotBase64,
  });
}
