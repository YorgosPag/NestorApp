'use client';

import { Suspense } from 'react';
import { StaticPageLoading } from '@/core/states';
import { ContactRoutes } from '@/components/contacts/contact-routes';
import { ProtectedRoute } from '@/auth';

// ADR-280 §11.8 Β4.3 — από το μητρώο, όχι στατικά: το chunk φέρνει τα κείμενά του (η κλειστότητα ονομάζει DXF/BIM).
const Contacts = ContactRoutes.Contacts;

export default function ContactsPage() {
  return (
    <ProtectedRoute>
      <Suspense fallback={<StaticPageLoading />}>
        <Contacts />
      </Suspense>
    </ProtectedRoute>
  );
}
