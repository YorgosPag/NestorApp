'use client';

import { Suspense } from 'react';
import { StaticPageLoading } from '@/core/states';
import { LazyRoutes } from '@/utils/lazyRoutes';
import { ProtectedRoute } from '@/auth';

// ADR-280 §11.8 Β4.3 — από το μητρώο, όχι στατικά: το chunk φέρνει τα κείμενά του (η κλειστότητα ονομάζει DXF/BIM).
const Contacts = LazyRoutes.Contacts;

export default function ContactsPage() {
  return (
    <ProtectedRoute>
      <Suspense fallback={<StaticPageLoading />}>
        <Contacts />
      </Suspense>
    </ProtectedRoute>
  );
}
