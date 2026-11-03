import { notFound } from 'next/navigation';
import { isTestHarnessRouteEnabled } from '@/config/test-harness-access';
import { PropertyHandoverOfficeHarness } from '@/components/property-handover-office/testing/PropertyHandoverOfficeHarness';
import { NotificationProvider } from '@/providers/NotificationProvider';

/**
 * `/test-harness/property-handover-tab` — κάθε λόγος της κρίσης της καρτέλας «Παράδοση» του γραφείου (ADR-916 §5.15 Φ-Δ).
 * Μόνο εκτός παραγωγής (`isTestHarnessRouteEnabled`) — ίδιο σχήμα με το `/test-harness/handover-protocol-verify`.
 *
 * Ζει στο `(bare)` ώστε το `notFound()` να δίνει 404 πριν ξεκινήσει ροή (ADR-781 §19.4). Το group δεν έχει
 * `NotificationProvider`, και το `HandoverEntryCard` τον θέλει (`useFileDownload` → `useNotifications`).
 */
export default function PropertyHandoverTabHarnessPage() {
  if (!isTestHarnessRouteEnabled()) {
    notFound();
  }

  return (
    <NotificationProvider>
      <PropertyHandoverOfficeHarness />
    </NotificationProvider>
  );
}
