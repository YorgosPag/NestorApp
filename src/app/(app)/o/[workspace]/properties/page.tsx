'use client';

import React, { Suspense } from 'react';
import { StaticPageLoading } from '@/core/states';
import { LazyRoutes } from '@/utils/lazyRoutes';

// ADR-280 §11.8 Β4.3 — από το μητρώο, όχι στατικά: το chunk φέρνει τα κείμενά του (η κλειστότητα ονομάζει DXF/BIM).
const Properties = LazyRoutes.Properties;

export default function PropertiesIndexPage() {
  return (
    <Suspense fallback={<StaticPageLoading />}>
      <Properties />
    </Suspense>
  );
}
