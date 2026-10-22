import { notFound } from 'next/navigation';
import { isTestHarnessRouteEnabled } from '@/config/test-harness-access';
import { PropertyHandoverOfficeHarness } from '@/components/property-handover-office/testing/PropertyHandoverOfficeHarness';

/**
 * `/test-harness/property-handover-tab` — κάθε λόγος της κρίσης της καρτέλας «Παράδοση» του γραφείου (ADR-916 §5.15 Φ-Δ).
 * Μόνο εκτός παραγωγής (`isTestHarnessRouteEnabled`) — ίδιο σχήμα με το `/test-harness/handover-protocol-verify`.
 */
export default function PropertyHandoverTabHarnessPage() {
  if (!isTestHarnessRouteEnabled()) {
    notFound();
  }

  return <PropertyHandoverOfficeHarness />;
}
