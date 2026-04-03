'use client';

import React, { Suspense } from 'react';
import { StaticPageLoading } from '@/core/states';
import { PropertyGridView } from '@/features/property-grid/PropertyGridView';

export default function PropertiesIndexPage() {
  return (
    <Suspense fallback={<StaticPageLoading />}>
      <PropertyGridView />
    </Suspense>
  );
}
