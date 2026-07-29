import { notFound } from 'next/navigation';
import { isPerfHarnessRouteEnabled } from '@/config/test-harness-access';
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
 * 404 σε παραγωγή, **εκτός** αν το build ζήτησε ρητά το αντίθετο με
 * `ENABLE_PERF_HARNESS=1` — το κριτήριο Φ5 απαιτεί μέτρηση σε production build, και η
 * έκδοση ανάπτυξης (StrictMode = διπλό render) δεν το περιγράφει. Διακόπτης χρόνου
 * **κατασκευής**, σβηστός από προεπιλογή· λεπτομέρειες στο SSoT της πολιτικής.
 */
export default function DxfPerfHarnessPage() {
  if (!isPerfHarnessRouteEnabled()) notFound();
  return <DxfPerfHarness />;
}
