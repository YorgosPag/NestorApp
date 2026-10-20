import { notFound } from 'next/navigation';
import { isTestHarnessRouteEnabled } from '@/config/test-harness-access';
import { HandoverInviteHarness } from '@/components/handover-invite/testing/HandoverInviteHarness';

/**
 * `/test-harness/handover-invite` — κάθε κατάσταση της πρόσκλησης αγοραστή και της προέλευσης φακέλου (ADR-916 Φ-Β2).
 * Μόνο εκτός παραγωγής (`isTestHarnessRouteEnabled`) — ίδιο σχήμα με το `/test-harness/first-contact-proof`.
 */
export default function HandoverInviteHarnessPage() {
  if (!isTestHarnessRouteEnabled()) {
    notFound();
  }

  return <HandoverInviteHarness />;
}
