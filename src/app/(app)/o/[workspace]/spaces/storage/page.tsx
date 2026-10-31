'use client';

import { Suspense } from 'react';
import { StaticPageLoading } from '@/core/states';
import { LazyRoutes } from '@/utils/lazyRoutes';

// ADR-280 §11.8 Β4.3 — από το μητρώο, όχι στατικά: το chunk φέρνει τα κείμενά του (η κλειστότητα ονομάζει DXF/BIM).
const SpacesStorage = LazyRoutes.SpacesStorage;

export default function StoragePage() {
  return (
    <Suspense fallback={<StaticPageLoading />}>
      <SpacesStorage />
    </Suspense>
  );
}
