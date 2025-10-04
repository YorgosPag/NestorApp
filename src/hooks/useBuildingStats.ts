'use client';

import { useMemo } from 'react';
import type { Building } from '@/components/building-management/BuildingsPageContent';

export function useBuildingStats(buildings: Building[]) {
  const stats = useMemo(() => {
    return {
      totalBuildings: buildings.length,
      activeProjects: buildings.filter(b => b.status === 'active' || b.status === 'construction').length,
      totalValue: buildings.reduce((sum, b) => sum + (b.totalValue || 0), 0),
      totalArea: buildings.reduce((sum, b) => sum + b.totalArea, 0),
      averageProgress: buildings.length > 0 ? Math.round(buildings.reduce((sum, b) => sum + b.progress, 0) / buildings.length) : 0,
      totalUnits: buildings.reduce((sum, b) => sum + (b.units || 0), 0)
    };
  }, [buildings]);

  return stats;
}
