import { notFound } from 'next/navigation';
import { isTestHarnessRouteEnabled } from '@/config/test-harness-access';
import { ContactMutationHarness } from '@/components/contacts/testing/ContactMutationHarness';

export default function ContactMutationHarnessPage() {
  if (!isTestHarnessRouteEnabled()) {
    notFound();
  }

  return <ContactMutationHarness />;
}
