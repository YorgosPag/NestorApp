'use client';

import React from 'react';
import { LazyRoutes } from '@/utils/lazyRoutes';
import { ProtectedRoute } from '@/auth';
import '@/lib/design-system';

export default function BuildingManagementPage() {
  const Buildings = LazyRoutes.Buildings;
  return (
    <ProtectedRoute>
      <div className="h-full">
        <Buildings />
      </div>
    </ProtectedRoute>
  );
}
