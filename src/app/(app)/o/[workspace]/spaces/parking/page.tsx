'use client';

import { Suspense } from 'react';
import { StaticPageLoading } from '@/core/states';
import { ParkingPageContent } from '@/components/space-management/ParkingPage/ParkingPageContent';

export default function ParkingPage() {
  return (
    <Suspense fallback={<StaticPageLoading />}>
      <ParkingPageContent />
    </Suspense>
  );
}
