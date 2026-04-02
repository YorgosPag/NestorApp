'use client';

import React, { Suspense } from 'react';
import { StaticPageLoading } from '@/core/states';
import { UnitsPageContent } from '@/components/properties/UnitsPageContent';

export default function UnitsPage() {
  return (
    <Suspense fallback={<StaticPageLoading />}>
      <UnitsPageContent />
    </Suspense>
  );
}
