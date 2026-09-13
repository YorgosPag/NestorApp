import { notFound } from 'next/navigation';

import { isTestHarnessRouteEnabled } from '@/config/test-harness-access';

import AddressFieldWidthHarness from './AddressFieldWidthHarness';

/**
 * ADR-332 D27 Ζ7 — harness ωφέλιμου πλάτους πεδίων διεύθυνσης.
 *
 * Ακολουθεί **ακριβώς** το μοτίβο του `/test-harness/camera-motion`: ο φρουρός έκθεσης
 * είναι το SSoT `isTestHarnessRouteEnabled()` *(ΟΧΙ inline έλεγχος `NODE_ENV`)*.
 * **404 σε παραγωγή.**
 */
export default function AddressFieldWidthHarnessPage() {
  if (!isTestHarnessRouteEnabled()) notFound();
  return <AddressFieldWidthHarness />;
}
