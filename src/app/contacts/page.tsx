'use client';

import { Suspense } from 'react';
import { StaticPageLoading } from '@/core/states';
import { ContactsPageContent } from '@/components/contacts/ContactsPageContent';

export default function ContactsPage() {
  return (
    <Suspense fallback={<StaticPageLoading />}>
      <ContactsPageContent />
    </Suspense>
  );
}
