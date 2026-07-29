import { notFound } from 'next/navigation';
import DxfPerfHarness from './DxfPerfHarness';

/**
 * ADR-726 §13.1 — frame-budget harness: mounts the WHOLE `DxfViewerApp` (all 13
 * canvases) with persistence disabled, so Playwright can measure pan/zoom without
 * auth or Firestore inside the measurement loop.
 *
 * Deliberately NOT the 3-canvas `/test-harness/dxf-canvas` (isolated component in a
 * tight loop — the pattern Speedometer 3 abandoned) and NOT `/dxf/viewer` (AdminGuard
 * puts the backend in the loop — the noise Web Page Replay exists to remove).
 *
 * Dev-only — 404 in production, same guard as its sibling harnesses. The Φ5 criterion
 * needs a production measurement; that opt-in is a separate, explicit decision.
 */
export default function DxfPerfHarnessPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <DxfPerfHarness />;
}
