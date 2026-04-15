'use client';

import { Suspense } from 'react';
import { StaticPageLoading } from '@/core/states';
import { StoragePageContent } from '@/components/space-management/StoragesPage/StoragePageContent';

export default function StoragePage() {
  return (
    <Suspense fallback={<StaticPageLoading />}>
      <StoragePageContent />
    </Suspense>
  );
}
