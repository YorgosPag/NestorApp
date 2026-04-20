'use client';

/**
 * 📊 PropertyPageDashboard
 *
 * Dashboard section of the properties page. Wraps `UnifiedDashboard` plus the
 * Status / Details / Coverage cards. Extracted so `UnitsPageContent` stays
 * under the Google 500-line limit (N.7.1) and keeps dashboard concerns
 * together (SRP).
 *
 * @module components/properties/page/PropertyPageDashboard
 */

import { MapPin } from 'lucide-react';
import { UnifiedDashboard, type DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import { StatusCard } from '@/components/property-management/dashboard/StatusCard';
import { DetailsCard } from '@/components/property-management/dashboard/DetailsCard';
import { CoverageCard } from '@/components/property-management/dashboard/CoverageCard';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface DashboardStatsInput {
  propertiesByStatus: Record<string, number>;
  propertiesByType: Record<string, number>;
  propertiesByFloor: Record<string, number>;
  coverage: {
    photos: { missing: number; total: number };
    floorplans: { missing: number; total: number };
    documents: { missing: number; total: number };
  };
}

interface PropertyPageDashboardProps {
  unifiedDashboardStats: DashboardStat[];
  dashboardStats: DashboardStatsInput;
  onCardClick: (cardId: string) => void;
  getStatusLabel: (status: string) => string;
  getTypeLabel: (type: string) => string;
  onMissingPhotosClick: () => void;
  onMissingFloorplansClick: () => void;
  onMissingDocumentsClick: () => void;
}

export function PropertyPageDashboard({
  unifiedDashboardStats,
  dashboardStats,
  onCardClick,
  getStatusLabel,
  getTypeLabel,
  onMissingPhotosClick,
  onMissingFloorplansClick,
  onMissingDocumentsClick,
}: PropertyPageDashboardProps) {
  const { t } = useTranslation(['properties']);
  return (
    <UnifiedDashboard
      stats={unifiedDashboardStats}
      columns={6}
      onCardClick={onCardClick}
      additionalContainers={
        <>
          <StatusCard statsByStatus={dashboardStats.propertiesByStatus} getStatusLabel={getStatusLabel} />
          <DetailsCard title={t('page.dashboard.unitTypes')} icon={NAVIGATION_ENTITIES.property.icon} data={dashboardStats.propertiesByType} labelFormatter={getTypeLabel} />
          <DetailsCard title={t('page.dashboard.floorDistribution')} icon={MapPin} data={dashboardStats.propertiesByFloor} isFloorData />
          <CoverageCard
            coverage={dashboardStats.coverage}
            onMissingPhotosClick={onMissingPhotosClick}
            onMissingFloorplansClick={onMissingFloorplansClick}
            onMissingDocumentsClick={onMissingDocumentsClick}
          />
        </>
      }
    />
  );
}
