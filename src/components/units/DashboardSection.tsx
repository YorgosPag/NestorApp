
'use client';

import React from 'react';
import { PropertyDashboard } from '@/components/property-management/PropertyDashboard';
import type { PropertyStats } from '@/types/property';

interface DashboardSectionProps {
  stats: PropertyStats;
}

export function DashboardSection({ stats }: DashboardSectionProps) {
  return (
    <div className="px-4 pt-4 shrink-0">
      <PropertyDashboard stats={stats} />
    </div>
  );
}
