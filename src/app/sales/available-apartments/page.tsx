'use client';

import React from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { UnifiedDashboard, type DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import {
  DollarSign,
  Calendar,
  TrendingUp,
  Eye,
  Users,
} from 'lucide-react';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PageContainer } from '@/core/containers';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

// 🏢 ENTERPRISE: Centralized Unit Icon & Color
const UnitIcon = NAVIGATION_ENTITIES.unit.icon;
const unitColor = NAVIGATION_ENTITIES.unit.color;

export default function AvailableApartmentsPage() {
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();
  // 🏢 ENTERPRISE: i18n support
  const { t } = useTranslation('common');

  // Placeholder stats for Available Apartments - inside component for i18n access
  const availableStats: DashboardStat[] = [
    {
      title: t('sales.available.stats.availableApartments'),
      value: '142',
      description: t('sales.available.stats.forSaleNow'),
      icon: NAVIGATION_ENTITIES.unit.icon,
      color: 'blue',
      trend: { value: -8, label: t('sales.stats.decrease') }
    },
    {
      title: t('sales.available.stats.avgPrice'),
      value: '€385K',
      description: t('sales.available.stats.avgPriceDesc'),
      icon: DollarSign,
      color: 'green',
      trend: { value: 12, label: t('sales.stats.increase') }
    },
    {
      title: t('sales.available.stats.interest'),
      value: '67',
      description: t('sales.available.stats.activeViews'),
      icon: Eye,
      color: 'purple',
      trend: { value: 23, label: t('sales.stats.increase') }
    },
    {
      title: t('sales.available.stats.avgTime'),
      value: '4.2 μήνες',
      description: t('sales.available.stats.onMarket'),
      icon: Calendar,
      color: 'orange',
      trend: { value: -15, label: t('sales.stats.decrease') }
    }
  ];
  return (
    <TooltipProvider>
      <PageContainer fullScreen ariaLabel={t('sales.available.title')}>
        {/* Header */}
          <div className={`border-b ${colors.bg.primary}/95 backdrop-blur supports-[backdrop-filter]:${colors.bg.primary}/60`}>
            <div className="flex h-14 items-center px-4">
              <div className="flex items-center gap-2">
                <UnitIcon className={`${iconSizes.md} ${unitColor}`} />
                <h1 className="text-lg font-semibold">{t('sales.available.title')}</h1>
              </div>
              <div className={`ml-auto text-sm ${colors.text.muted}`}>
                {t('sales.available.subtitle')}
              </div>
            </div>
          </div>

          {/* Dashboard Stats - Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <UnifiedDashboard
              title={t('sales.available.overview')}
              stats={availableStats}
              variant="modern"
            />

            {/* Available Types */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Γκαρσονιέρες */}
              <div className={`p-6 bg-card ${quick.card} hover:bg-accent/50 transition-colors cursor-pointer`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 ${colors.bg.info}/10 rounded-lg`}>
                    <UnitIcon className={`${iconSizes.md} ${unitColor}`} />
                  </div>
                  <h3 className="font-semibold">{t('sales.available.types.studios.title')}</h3>
                </div>
                <p className={`text-sm ${colors.text.muted} mb-2`}>
                  {t('sales.available.types.studios.description')}
                </p>
                <div className="text-2xl font-bold">34</div>
                <div className="space-y-2 mt-3">
                  <div className="flex justify-between text-sm">
                    <span className={colors.text.muted}>{t('sales.available.types.avgPrice')}</span>
                    <span className={`${colors.text.success} font-medium`}>€185K</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className={colors.text.muted}>{t('sales.available.types.sqmRange')}</span>
                    <span>25-45 τ.μ.</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className={colors.text.muted}>{t('sales.available.types.activeViews')}</span>
                    <span className={`${colors.text.warning} font-medium`}>12</span>
                  </div>
                </div>
              </div>

              {/* Δυάρια */}
              <div className={`p-6 bg-card ${quick.card} hover:bg-accent/50 transition-colors cursor-pointer`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 ${colors.bg.success}/10 rounded-lg`}>
                    <UnitIcon className={`${iconSizes.md} ${unitColor}`} />
                  </div>
                  <h3 className="font-semibold">{t('sales.available.types.oneBedroom.title')}</h3>
                </div>
                <p className={`text-sm ${colors.text.muted} mb-2`}>
                  {t('sales.available.types.oneBedroom.description')}
                </p>
                <div className="text-2xl font-bold">67</div>
                <div className="space-y-2 mt-3">
                  <div className="flex justify-between text-sm">
                    <span className={colors.text.muted}>{t('sales.available.types.avgPrice')}</span>
                    <span className={`${colors.text.success} font-medium`}>€295K</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className={colors.text.muted}>{t('sales.available.types.sqmRange')}</span>
                    <span>55-85 τ.μ.</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className={colors.text.muted}>{t('sales.available.types.activeViews')}</span>
                    <span className={`${colors.text.warning} font-medium`}>31</span>
                  </div>
                </div>
              </div>

              {/* Τριάρια+ */}
              <div className={`p-6 bg-card ${quick.card} hover:bg-accent/50 transition-colors cursor-pointer`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 ${colors.bg.warning}/10 rounded-lg`}>
                    <UnitIcon className={`${iconSizes.md} ${unitColor}`} />
                  </div>
                  <h3 className="font-semibold">{t('sales.available.types.twoBedroom.title')}</h3>
                </div>
                <p className={`text-sm ${colors.text.muted} mb-2`}>
                  {t('sales.available.types.twoBedroom.description')}
                </p>
                <div className="text-2xl font-bold">41</div>
                <div className="space-y-2 mt-3">
                  <div className="flex justify-between text-sm">
                    <span className={colors.text.muted}>{t('sales.available.types.avgPrice')}</span>
                    <span className={`${colors.text.success} font-medium`}>€485K</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className={colors.text.muted}>{t('sales.available.types.sqmRange')}</span>
                    <span>90-150 τ.μ.</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className={colors.text.muted}>{t('sales.available.types.activeViews')}</span>
                    <span className={`${colors.text.warning} font-medium`}>24</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Price Ranges & Interest */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Κλιμάκια Τιμών */}
              <div className="space-y-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <DollarSign className={iconSizes.md} />
                  {t('sales.available.priceRanges.title')}
                </h2>

                <div className="space-y-3">
                  <div className={`p-4 bg-card ${quick.card}`}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium">€100K - €250K</span>
                      <span className={`${colors.bg.success}/20 ${colors.text.success} px-2 py-1 rounded text-sm font-medium`}>
                        {t('sales.available.priceRanges.available', { count: 42 })}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {t('sales.available.priceRanges.range1Desc')}
                    </p>
                  </div>

                  <div className={`p-4 bg-card ${quick.card}`}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium">€250K - €400K</span>
                      <span className={`${colors.bg.info}/20 ${colors.text.info} px-2 py-1 rounded text-sm font-medium`}>
                        {t('sales.available.priceRanges.available', { count: 67 })}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {t('sales.available.priceRanges.range2Desc')}
                    </p>
                  </div>

                  <div className={`p-4 bg-card ${quick.card}`}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium">€400K+</span>
                      <span className={`${colors.bg.warning}/20 ${colors.text.warning} px-2 py-1 rounded text-sm font-medium`}>
                        {t('sales.available.priceRanges.available', { count: 33 })}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {t('sales.available.priceRanges.range3Desc')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Ενδιαφέρον & Δραστηριότητα */}
              <div className="space-y-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Eye className={iconSizes.md} />
                  {t('sales.available.activity.title')}
                </h2>

                <div className={`p-6 bg-card ${quick.card}`}>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground flex items-center gap-2">
                        <Users className={iconSizes.sm} />
                        {t('sales.available.activity.activeVisits')}
                      </span>
                      <span className={`font-medium ${colors.text.success}`}>{t('sales.available.activity.requests', { count: 127 })}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground flex items-center gap-2">
                        <Calendar className={iconSizes.sm} />
                        {t('sales.available.activity.scheduledVisits')}
                      </span>
                      <span className={`font-medium ${colors.text.info}`}>{t('sales.available.activity.appointments', { count: 34 })}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground flex items-center gap-2">
                        <DollarSign className={iconSizes.sm} />
                        {t('sales.available.activity.offersUnderReview')}
                      </span>
                      <span className={`font-medium ${colors.text.warning}`}>{t('sales.available.activity.offers', { count: 18 })}</span>
                    </div>
                    <div className="border-t pt-3 mt-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground flex items-center gap-2">
                          <TrendingUp className={iconSizes.sm} />
                          {t('sales.available.activity.hotProperties', { count: 5 })}
                        </span>
                        <span className={`font-semibold ${colors.text.error}`}>{t('sales.available.activity.properties', { count: 23 })}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Info Message */}
            <div className={`p-4 bg-muted/50 ${quick.card}`}>
              <div className="flex items-center gap-2 text-sm">
                <UnitIcon className={`${iconSizes.sm} ${unitColor}`} />
                <span className="font-medium">{t('sales.available.info.title')}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {t('sales.available.info.description')}
              </p>
            </div>
          </div>
      </PageContainer>
    </TooltipProvider>
  );
}