import { notFound } from 'next/navigation';

import { isTestHarnessRouteEnabled } from '@/config/test-harness-access';

import CameraMotionHarness from './CameraMotionHarness';

/**
 * ADR-847 §9 — harness κίνησης κάμερας.
 *
 * Ακολουθεί **ακριβώς** το μοτίβο του `/test-harness/contrast-matrix`: ο φρουρός έκθεσης
 * είναι το SSoT `isTestHarnessRouteEnabled()` *(ΟΧΙ inline έλεγχος `NODE_ENV` — εκείνη η
 * σκόρπια εκδοχή κεντρικοποιήθηκε ήδη μία φορά)*. **404 σε παραγωγή.**
 */
export default function CameraMotionHarnessPage() {
  if (!isTestHarnessRouteEnabled()) notFound();
  return <CameraMotionHarness />;
}
