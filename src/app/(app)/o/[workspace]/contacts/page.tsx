'use client';

import { Suspense } from 'react';
import { StaticPageLoading } from '@/core/states';
import { ContactsPageContent } from '@/components/contacts/ContactsPageContent';
import { ProtectedRoute } from '@/auth';

export default function ContactsPage() {
  return (
    <ProtectedRoute>
      <Suspense fallback={<StaticPageLoading />}>
        <ContactsPageContent />
      </Suspense>
    </ProtectedRoute>
  );
}
