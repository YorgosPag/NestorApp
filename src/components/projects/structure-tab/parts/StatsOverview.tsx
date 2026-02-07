'use client';

/**
 * 🏢 ENTERPRISE: Stats Overview Component
 *
 * Displays project statistics for all building spaces:
 * - Units (Μονάδες)
 * - Storage (Αποθήκες)
 * - Parking (Θέσεις Στάθμευσης)
 *
 * @module components/projects/structure-tab/parts/StatsOverview
 */

import React from 'react';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config/navigation-entities';
import { BarChart3 } from 'lucide-react';
import { UnifiedDashboard } from '@/components/property-management/dashboard/UnifiedDashboard';
import type { DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import type { ProjectTotals } from '../utils/selectors';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

type StatsOverviewProps = ProjectTotals;

export function StatsOverview({
  totalUnits,
  soldUnits,
  unitsArea,
  totalStorages,
  soldStorages,
  storagesArea,
  totalParkingSpots,
  soldParkingSpots,
  parkingArea,
  totalSpaces,
  totalArea,
  soldPct
}: StatsOverviewProps) {
  const { t } = useTranslation('projects');

  const dashboardStats: DashboardStat[] = [
    {
      title: t('structure.stats.units', 'Μονάδες'),
      value: totalUnits,
      description: `${soldUnits} ${t('structure.stats.sold', 'πωλημένες')} • ${unitsArea.toFixed(0)} m²`,
      icon: NAVIGATION_ENTITIES.unit.icon,
      color: 'blue',
    },
    {
      title: t('structure.stats.storages', 'Αποθήκες'),
      value: totalStorages,
      description: `${soldStorages} ${t('structure.stats.sold', 'πωλημένες')} • ${storagesArea.toFixed(0)} m²`,
      icon: NAVIGATION_ENTITIES.storage.icon,
      color: 'yellow',
    },
    {
      title: t('structure.stats.parking', 'Θέσεις'),
      value: totalParkingSpots,
      description: `${soldParkingSpots} ${t('structure.stats.sold', 'πωλημένες')} • ${parkingArea.toFixed(0)} m²`,
      icon: NAVIGATION_ENTITIES.parking.icon,
      color: 'purple',
    },
    {
      title: t('structure.stats.salesPct', '% Πωλήσεων'),
      value: `${soldPct.toFixed(1)}%`,
      description: `${t('structure.stats.totalSpaces', 'Σύνολο')}: ${totalSpaces} • ${totalArea.toFixed(0)} m²`,
      icon: BarChart3,
      color: 'orange',
    },
  ];

  return (
    <UnifiedDashboard
      stats={dashboardStats}
      columns={4}
      className=""
    />
  );
}
