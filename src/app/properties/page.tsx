'use client';

import React, { Suspense } from 'react';
import { StaticPageLoading } from '@/core/states';
import { PropertiesPageContent } from '@/components/properties/PropertiesPageContent';

export default function PropertiesIndexPage() {
  return (
    <Suspense fallback={<StaticPageLoading />}>
      <PropertiesPageContent />
    </Suspense>
  );
}
