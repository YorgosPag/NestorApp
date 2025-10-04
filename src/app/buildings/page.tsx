
'use client';

import React from 'react';
import { LazyRoutes } from '@/utils/lazyRoutes';

export default function BuildingManagementPage() {
  const Buildings = LazyRoutes.Buildings;
  return (
    <div className="h-full">
      <Buildings />
    </div>
  );
}
