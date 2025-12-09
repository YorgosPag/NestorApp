'use client';

import React, { Suspense } from 'react';
import { ContactsPageContent } from '@/components/contacts/ContactsPageContent';

export default function ContactsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Φόρτωση επαφών...</p>
        </div>
      </div>
    }>
      <ContactsPageContent />
    </Suspense>
  );
}
