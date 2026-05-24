/**
 * performance-snapshot-service — ADR-366 §B.5 + §C.7.Q4
 *
 * Client-side facade that posts a performance diagnostic snapshot to the
 * server-side route `/api/performance-diagnostics`. The server handles
 * Storage upload (Admin SDK), Firestore write, and EntityAuditService audit
 * — clients never write directly to `performance_diagnostics` (see
 * firestore.rules and the related Boy Scout that hardened the rule block).
 *
 * Sources accepted by the route:
 *   - 'manual'      → user clicked "Send to support" in the HUD dialog (B.5)
 *   - 'auto_submit' → §C.7.Q4 FSM accepted prompt (sustained FPS<10)
 */

import type { PerformanceMetricsSnapshot } from './PerformanceHUDStore';

export interface DiagnosticInput {
  companyId: string;
  userId: string;
  projectId: string | null;
  metrics: PerformanceMetricsSnapshot;
  renderMode: string;
  canvas: HTMLCanvasElement;
  comment: string;
  /** Defaults to 'manual' for backward compatibility with existing call sites. */
  source?: 'manual' | 'auto_submit';
}

export async function sendDiagnostic(input: DiagnosticInput): Promise<void> {
  const { metrics, renderMode, canvas, comment, projectId, source = 'manual' } = input;

  const dataUrl = canvas.toDataURL('image/png', 0.92);
  const screenshotBase64 = dataUrl.split(',')[1] ?? dataUrl;

  const response = await fetch('/api/performance-diagnostics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectId,
      metrics,
      renderMode,
      comment: comment || null,
      source,
      screenshotBase64,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(`performance-diagnostics POST failed: ${response.status} ${text}`);
  }
}
