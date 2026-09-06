import { notFound } from 'next/navigation';
import { isTestHarnessRouteEnabled } from '@/config/test-harness-access';
import { FirstContactProofHarness } from '@/components/contact/testing/FirstContactProofHarness';

export default function FirstContactProofHarnessPage() {
  if (!isTestHarnessRouteEnabled()) {
    notFound();
  }

  return <FirstContactProofHarness />;
}
