import { notFound } from 'next/navigation';
import { isTestHarnessRouteEnabled } from '@/config/test-harness-access';
import { HandoverProtocolVerifyHarness } from '@/components/handover-protocol-verify/testing/HandoverProtocolVerifyHarness';

/**
 * `/test-harness/handover-protocol-verify` — κάθε ετυμηγορία της δημόσιας πόρτας επαλήθευσης Πρωτοκόλλου (ADR-916 Φ-Γ2 Σ6).
 * Μόνο εκτός παραγωγής (`isTestHarnessRouteEnabled`) — ίδιο σχήμα με το `/test-harness/handover-invite`.
 */
export default function HandoverProtocolVerifyHarnessPage() {
  if (!isTestHarnessRouteEnabled()) {
    notFound();
  }

  return <HandoverProtocolVerifyHarness />;
}
