import { notFound } from 'next/navigation';

import { isTestHarnessRouteEnabled } from '@/config/test-harness-access';

import TourViewerHarness from './TourViewerHarness';

/**
 * ADR-884 Φ1 — ο θεατής περιήγησης με **εικονικά δεδομένα** (η έξοδος της φάσης, ADR-884 §8).
 *
 * Μοτίβο `/test-harness/camera-motion`: φρουρός έκθεσης = το SSoT `isTestHarnessRouteEnabled()` — **404 σε παραγωγή**.
 * Στο `(bare)`: ο θεατής κρίνεται χωρίς κέλυφος στο κάδρο.
 */
export default function TourViewerHarnessPage() {
  if (!isTestHarnessRouteEnabled()) notFound();
  return <TourViewerHarness />;
}
