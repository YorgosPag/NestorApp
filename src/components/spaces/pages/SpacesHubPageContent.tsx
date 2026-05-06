'use client';

/**
 * @module spaces/hub
 * @enterprise Spaces Hub Dashboard
 * @lazy ADR-294 Batch 3 — Extracted for dynamic import
 */

import React from 'react';
import Link from 'next/link';
import { UnifiedDashboard, type DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import {
  Package,
  Car,
  Users,
  Layout,
} from 'lucide-react';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { ModuleBreadcrumb } from '@/components/shared/ModuleBreadcrumb';
import { useSharedProperties } from '@/contexts/SharedPropertiesProvider';
import { useFirestoreStorages } from '@/hooks/useFirestoreStorages';
import { useFirestoreParkingSpots } from '@/hooks/useFirestoreParkingSpots';
import '@/lib/design-system';

export function SpacesHubPageContent() {
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();
  const { t } = useTranslation(['common', 'common-account', 'common-actions', 'common-empty-states', 'common-navigation', 'common-photos', 'common-sales', 'common-shared', 'common-status', 'common-validation']);

  const { properties, isLoading: propertiesLoading } = useSharedProperties();
  const { storages, loading: storagesLoading } = useFirestoreStorages();
  const { parkingSpots, loading: parkingLoading } = useFirestoreParkingSpots();

  const isLoading = propertiesLoading || storagesLoading || parkingLoading;

  const propertiesCount = properties.length;
  const storagesCount = storages.length;
  const parkingCount = parkingSpots.length;
  const totalCount = propertiesCount + storagesCount + parkingCount;

  const fmt = (n: number) => isLoading ? '…' : n.toLocaleString('el-GR');

  const spacesStats: DashboardStat[] = [
    {
      title: t('spaces.stats.totalSpaces'),
      value: fmt(totalCount),
      description: t('spaces.stats.allPhysicalSpaces'),
      icon: Layout,
      color: 'blue',
      trend: { value: 0, label: t('spaces.stats.stable') }
    },
    {
      title: t('spaces.stats.apartments'),
      value: fmt(propertiesCount),
      description: t('spaces.stats.residentialSpaces'),
      icon: NAVIGATION_ENTITIES.property.icon,
      color: 'green',
      trend: { value: 0, label: t('spaces.stats.stable') }
    },
    {
      title: t('spaces.stats.storageUnits'),
      value: fmt(storagesCount),
      description: t('spaces.stats.storageSpaces'),
      icon: Package,
      color: 'orange',
      trend: { value: 0, label: t('spaces.stats.stable') }
    },
    {
      title: t('spaces.stats.parkingSpaces'),
      value: fmt(parkingCount),
      description: t('spaces.stats.parkingAreas'),
      icon: Car,
      color: 'purple',
      trend: { value: 0, label: t('spaces.stats.stable') }
    }
  ];

  return (
    <div className={`flex h-screen ${colors.bg.primary}`}>
        <div className="flex-1 flex flex-col">
          <div className={`border-b ${colors.bg.primary}/95 backdrop-blur supports-[backdrop-filter]:${colors.bg.primary}/60`}>
            <ModuleBreadcrumb className="px-4 pt-2" />
            <div className="flex h-14 items-center px-4">
              <div className="flex items-center gap-2">
                <Layout className={`${iconSizes.md} ${colors.text.muted}`} />
                <h1 className="text-lg font-semibold">{t('spaces.title')}</h1>
              </div>
              <div className={`ml-auto text-sm ${colors.text.muted}`}>
                {t('spaces.subtitle')}
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <UnifiedDashboard
              title={t('spaces.overview')}
              stats={spacesStats}
              variant="modern"
            />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Link href="/spaces/properties" className={`p-6 bg-card ${quick.card} hover:bg-accent/50 transition-colors cursor-pointer block`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    {React.createElement(NAVIGATION_ENTITIES.property.icon, { className: `${iconSizes.md} ${NAVIGATION_ENTITIES.property.color}` })}
                  </div>
                  <h3 className="font-semibold">{t('spaces.cards.apartments.title')}</h3>
                </div>
                <p className={`text-sm ${colors.text.muted} mb-2`}>
                  {t('spaces.cards.apartments.description')}
                </p>
                <div className="text-2xl font-bold">{fmt(propertiesCount)}</div>
                <p className={`text-xs ${colors.text.muted} mt-1`}>
                  {t('spaces.cards.apartments.details')}
                </p>
              </Link>

              <Link href="/spaces/storage" className={`p-6 bg-card ${quick.card} hover:bg-accent/50 transition-colors cursor-pointer block`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 ${colors.bg.warning}/10 rounded-lg`}>
                    <Package className={`${iconSizes.md} ${colors.text.warning}`} />
                  </div>
                  <h3 className="font-semibold">{t('spaces.cards.storage.title')}</h3>
                </div>
                <p className={`text-sm ${colors.text.muted} mb-2`}>
                  {t('spaces.cards.storage.description')}
                </p>
                <div className="text-2xl font-bold">{fmt(storagesCount)}</div>
                <p className={`text-xs ${colors.text.muted} mt-1`}>
                  {t('spaces.cards.storage.details')}
                </p>
              </Link>

              <Link href="/spaces/parking" className={`p-6 bg-card ${quick.card} hover:bg-accent/50 transition-colors cursor-pointer block`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 ${colors.bg.info}/10 rounded-lg`}>
                    <Car className={`${iconSizes.md} ${colors.text.info}`} />
                  </div>
                  <h3 className="font-semibold">{t('spaces.cards.parking.title')}</h3>
                </div>
                <p className={`text-sm ${colors.text.muted} mb-2`}>
                  {t('spaces.cards.parking.description')}
                </p>
                <div className="text-2xl font-bold">{fmt(parkingCount)}</div>
                <p className={`text-xs ${colors.text.muted} mt-1`}>
                  {t('spaces.cards.parking.details')}
                </p>
              </Link>

              <Link href="/spaces/common" className={`p-6 bg-card ${quick.card} hover:bg-accent/50 transition-colors cursor-pointer block`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 ${colors.bg.success}/10 rounded-lg`}>
                    <Users className={`${iconSizes.md} ${colors.text.success}`} />
                  </div>
                  <h3 className="font-semibold">{t('spaces.cards.common.title')}</h3>
                </div>
                <p className={`text-sm ${colors.text.muted} mb-2`}>
                  {t('spaces.cards.common.description')}
                </p>
                <div className="text-2xl font-bold">0</div>
                <p className={`text-xs ${colors.text.muted} mt-1`}>
                  {t('spaces.cards.common.details')}
                </p>
              </Link>
            </div>

            <div className={`p-4 bg-muted/50 ${quick.card}`}>
              <div className="flex items-center gap-2 text-sm">
                <Layout className={iconSizes.sm} />
                <span className="font-medium">{t('spaces.info.title')}</span>
              </div>
              <p className={`text-sm ${colors.text.muted} mt-1`}>
                {t('spaces.info.description')}
              </p>
            </div>
          </div>
        </div>
      </div>
  );
}

export default SpacesHubPageContent;
