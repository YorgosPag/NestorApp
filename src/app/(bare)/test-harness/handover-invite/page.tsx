import { notFound } from 'next/navigation';
import { isTestHarnessRouteEnabled } from '@/config/test-harness-access';
import { HandoverInviteHarness } from '@/components/handover-invite/testing/HandoverInviteHarness';
import { NotificationProvider } from '@/providers/NotificationProvider';

/**
 * `/test-harness/handover-invite` — κάθε κατάσταση της πρόσκλησης αγοραστή και της προέλευσης φακέλου (ADR-916 Φ-Β2).
 * Μόνο εκτός παραγωγής (`isTestHarnessRouteEnabled`) — ίδιο σχήμα με το `/test-harness/first-contact-proof`.
 *
 * Ζει στο `(bare)` ώστε το `notFound()` να δίνει 404 πριν ξεκινήσει ροή (ADR-781 §19.4). Το group δεν έχει
 * `NotificationProvider`, και το `PropertyDossierOrigin` της γκαλερί τον θέλει (`useFileDownload` → `useNotifications`).
 */
export default function HandoverInviteHarnessPage() {
  if (!isTestHarnessRouteEnabled()) {
    notFound();
  }

  return (
    <NotificationProvider>
      <HandoverInviteHarness />
    </NotificationProvider>
  );
}
