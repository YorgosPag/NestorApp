import { notFound } from 'next/navigation';
import { ContactMutationHarness } from '@/components/contacts/testing/ContactMutationHarness';

export default function ContactMutationHarnessPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  return <ContactMutationHarness />;
}
