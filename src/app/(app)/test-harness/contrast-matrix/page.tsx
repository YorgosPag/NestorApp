import { notFound } from 'next/navigation';
import { isTestHarnessRouteEnabled } from '@/config/test-harness-access';
import ContrastMatrixHarness from './ContrastMatrixHarness';

/**
 * ADR-770 Στρώμα 2β — harness πλέγματος αντίθεσης.
 *
 * Ακολουθεί ακριβώς το μοτίβο των `/test-harness/dxf-canvas` και `/test-harness/bim-3d`:
 * ο φρουρός έκθεσης είναι το SSoT `isTestHarnessRouteEnabled()` (ΟΧΙ inline έλεγχος
 * `NODE_ENV` — αυτή η σκόρπια εκδοχή κεντρικοποιήθηκε ήδη μία φορά).
 * 404 σε παραγωγή.
 */
export default function ContrastMatrixHarnessPage() {
  if (!isTestHarnessRouteEnabled()) notFound();
  return <ContrastMatrixHarness />;
}
