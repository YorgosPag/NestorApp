'use client';

/**
 * Building Statistics — thin wrapper over useEntityStats
 * @module hooks/useBuildingStats
 */

import { useMemo } from 'react';
import type { Building } from '@/components/building-management/BuildingsPageContent';
import { useEntityStats, countBy, sumBy, avgRounded } from './useEntityStats';

const getArea = (b: Building): number => b.totalArea ?? 0;
const getValue = (b: Building): number => b.totalValue || 0;

export function useBuildingStats(buildings: Building[]) {
  const base = useEntityStats(buildings, { getArea, getValue });

  const stats = useMemo(() => ({
    totalBuildings: base.total,
    activeProjects: countBy(buildings, b => b.status === 'active' || b.status === 'construction'),
    totalValue: base.totalValue,
    totalArea: base.totalArea,
    averageProgress: avgRounded(
      sumBy(buildings, b => b.progress ?? 0),
      base.total,
    ),
    totalUnits: sumBy(buildings, b => b.units || 0),
  }), [base, buildings]);

  return stats;
}
