'use client';

import React from 'react';
import { BuildingRoutes } from '@/components/building-management/building-routes';
import { ProtectedRoute } from '@/auth';
import '@/lib/design-system';

export default function BuildingManagementPage() {
  const Buildings = BuildingRoutes.Buildings;
  return (
    <ProtectedRoute>
      <div className="h-full">
        <Buildings />
      </div>
    </ProtectedRoute>
  );
}
