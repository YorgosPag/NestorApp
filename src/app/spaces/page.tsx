'use client';

import React from 'react';

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
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

export default function SpacesPage() {
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();
  // 🏢 ENTERPRISE: i18n support
  const { t } = useTranslation('common');

  // Placeholder stats for Physical Spaces - inside component for i18n access
  const spacesStats: DashboardStat[] = [
    {
      title: t('spaces.stats.totalSpaces'),
      value: '1,247',
      description: t('spaces.stats.allPhysicalSpaces'),
      icon: Layout,
      color: 'blue',
      trend: { value: 0, label: t('spaces.stats.stable') }
    },
    {
      title: t('spaces.stats.apartments'),
      value: '486',
      description: t('spaces.stats.residentialSpaces'),
      icon: NAVIGATION_ENTITIES.unit.icon,
      color: 'green',
      trend: { value: 0, label: t('spaces.stats.stable') }
    },
    {
      title: t('spaces.stats.storageUnits'),
      value: '324',
      description: t('spaces.stats.storageSpaces'),
      icon: Package,
      color: 'orange',
      trend: { value: 0, label: t('spaces.stats.stable') }
    },
    {
      title: t('spaces.stats.parkingSpaces'),
      value: '437',
      description: t('spaces.stats.parkingAreas'),
      icon: Car,
      color: 'purple',
      trend: { value: 0, label: t('spaces.stats.stable') }
    }
  ];
  return (
    <div className={`flex h-screen ${colors.bg.primary}`}>
        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className={`border-b ${colors.bg.primary}/95 backdrop-blur supports-[backdrop-filter]:${colors.bg.primary}/60`}>
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

          {/* Dashboard Stats */}
          <div className="p-6 space-y-6">
            <UnifiedDashboard
              title={t('spaces.overview')}
              stats={spacesStats}
              variant="modern"
            />

            {/* Navigation Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Apartments Card */}
              <div className={`p-6 bg-card ${quick.card} hover:bg-accent/50 transition-colors cursor-pointer`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    {React.createElement(NAVIGATION_ENTITIES.unit.icon, { className: `${iconSizes.md} ${NAVIGATION_ENTITIES.unit.color}` })}
                  </div>
                  <h3 className="font-semibold">{t('spaces.cards.apartments.title')}</h3>
                </div>
                <p className={`text-sm ${colors.text.muted} mb-2`}>
                  {t('spaces.cards.apartments.description')}
                </p>
                <div className="text-2xl font-bold">486</div>
                <p className={`text-xs ${colors.text.muted} mt-1`}>
                  {t('spaces.cards.apartments.details')}
                </p>
              </div>

              {/* Storage Card */}
              <div className={`p-6 bg-card ${quick.card} hover:bg-accent/50 transition-colors cursor-pointer`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 ${colors.bg.warning}/10 rounded-lg`}>
                    <Package className={`${iconSizes.md} ${colors.text.warning}`} />
                  </div>
                  <h3 className="font-semibold">{t('spaces.cards.storage.title')}</h3>
                </div>
                <p className={`text-sm ${colors.text.muted} mb-2`}>
                  {t('spaces.cards.storage.description')}
                </p>
                <div className="text-2xl font-bold">324</div>
                <p className={`text-xs ${colors.text.muted} mt-1`}>
                  {t('spaces.cards.storage.details')}
                </p>
              </div>

              {/* Parking Card */}
              <div className={`p-6 bg-card ${quick.card} hover:bg-accent/50 transition-colors cursor-pointer`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 ${colors.bg.info}/10 rounded-lg`}>
                    <Car className={`${iconSizes.md} ${colors.text.info}`} />
                  </div>
                  <h3 className="font-semibold">{t('spaces.cards.parking.title')}</h3>
                </div>
                <p className={`text-sm ${colors.text.muted} mb-2`}>
                  {t('spaces.cards.parking.description')}
                </p>
                <div className="text-2xl font-bold">437</div>
                <p className={`text-xs ${colors.text.muted} mt-1`}>
                  {t('spaces.cards.parking.details')}
                </p>
              </div>

              {/* Common Spaces Card */}
              <div className={`p-6 bg-card ${quick.card} hover:bg-accent/50 transition-colors cursor-pointer`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 ${colors.bg.success}/10 rounded-lg`}>
                    <Users className={`${iconSizes.md} ${colors.text.success}`} />
                  </div>
                  <h3 className="font-semibold">{t('spaces.cards.common.title')}</h3>
                </div>
                <p className={`text-sm ${colors.text.muted} mb-2`}>
                  {t('spaces.cards.common.description')}
                </p>
                <div className="text-2xl font-bold">42</div>
                <p className={`text-xs ${colors.text.muted} mt-1`}>
                  {t('spaces.cards.common.details')}
                </p>
              </div>
            </div>

            {/* Info Message */}
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