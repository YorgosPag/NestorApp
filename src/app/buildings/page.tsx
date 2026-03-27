
'use client';

import React from 'react';
import { LazyRoutes } from '@/utils/lazyRoutes';
import '@/lib/design-system';

export default function BuildingManagementPage() {
  const Buildings = LazyRoutes.Buildings;
  return (
    <div className="h-full">
      <Buildings />
    </div>
  );
}
