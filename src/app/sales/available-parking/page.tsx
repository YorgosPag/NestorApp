// 🌐 i18n: All labels converted to i18n keys - 2026-01-19
'use client';

import React from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { UnifiedDashboard, type DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import {
  Car,
  DollarSign,
  Building2,
  Square,
  TrendingUp,
  Eye,
  Calendar,
} from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PageContainer } from '@/core/containers';
import { useTranslation } from 'react-i18next';

export default function AvailableParkingPage() {
  const { t } = useTranslation('sales');
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();

  // 🌐 i18n: Stats use i18n keys
  const parkingStats: DashboardStat[] = [
    {
      title: t('availableParking.stats.available'),
      value: '93',
      description: t('availableParking.stats.forSaleNow'),
      icon: Car,
      color: 'blue',
      trend: { value: -2, label: t('common.decrease') }
    },
    {
      title: t('availableParking.stats.avgPrice'),
      value: '€22K',
      description: t('availableParking.stats.priceAverage'),
      icon: DollarSign,
      color: 'green',
      trend: { value: 6, label: t('common.increase') }
    },
    {
      title: t('availableParking.stats.interest'),
      value: '31',
      description: t('availableParking.stats.activeViews'),
      icon: Eye,
      color: 'purple',
      trend: { value: 18, label: t('common.increase') }
    },
    {
      title: t('availableParking.stats.avgTime'),
      value: t('availableParking.stats.months', { count: 3.4 }),
      description: t('availableParking.stats.onMarket'),
      icon: Calendar,
      color: 'orange',
      trend: { value: -12, label: t('common.decrease') }
    }
  ];
  return (
    <TooltipProvider>
      <PageContainer fullScreen ariaLabel={t('availableParking.pageLabel')}>
        {/* Header */}
          <div className={`border-b ${colors.bg.primary}/95 backdrop-blur supports-[backdrop-filter]:${colors.bg.primary}/60`}>
            <div className="flex h-14 items-center px-4">
              <div className="flex items-center gap-2">
                <Car className={`${iconSizes.md} ${colors.text.muted}`} />
                <h1 className="text-lg font-semibold">{t('availableParking.title')}</h1>
              </div>
              <div className={`ml-auto text-sm ${colors.text.muted}`}>
                {t('availableParking.subtitle')}
              </div>
            </div>
          </div>

          {/* Dashboard Stats - Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <UnifiedDashboard
              title={t('availableParking.overview')}
              stats={parkingStats}
              variant="modern"
            />

            {/* Parking Types */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Underground Parking */}
              <div className="space-y-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Building2 className={iconSizes.md} />
                  {t('availableParking.types.underground.title')}
                </h2>

                <div className="space-y-3">
                  <div className={`p-4 bg-card ${quick.card} hover:bg-accent/50 transition-colors cursor-pointer`}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-2 ${colors.bg.info}/10 rounded-lg`}>
                        <Building2 className={`${iconSizes.sm} ${colors.text.info}`} />
                      </div>
                      <h3 className="font-medium">{t('availableParking.types.underground.enclosed')}</h3>
                      <span className={`ml-auto ${colors.bg.info}/20 ${colors.text.info} px-2 py-1 rounded text-sm font-medium`}>
                        {t('availableParking.available', { count: 56 })}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className={colors.text.muted}>{t('availableParking.labels.avgPrice')}</span>
                        <span className={`${colors.text.success} font-medium`}>€28K</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className={colors.text.muted}>{t('availableParking.labels.range')}</span>
                        <span>€18K - €42K</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className={colors.text.muted}>{t('availableParking.labels.demand')}</span>
                        <span className={`${colors.text.warning} font-medium`}>{t('availableParking.demand.high')}</span>
                      </div>
                    </div>
                  </div>

                  <div className={`p-4 bg-card ${quick.card} hover:bg-accent/50 transition-colors cursor-pointer`}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-2 ${colors.bg.warning}/10 rounded-lg`}>
                        <Square className={`${iconSizes.sm} ${colors.text.accent}`} />
                      </div>
                      <h3 className="font-medium">{t('availableParking.types.underground.semiOpen')}</h3>
                      <span className={`ml-auto ${colors.bg.warning}/20 ${colors.text.warning} px-2 py-1 rounded text-sm font-medium`}>
                        {t('availableParking.available', { count: 19 })}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className={colors.text.muted}>{t('availableParking.labels.avgPrice')}</span>
                        <span className={`${colors.text.success} font-medium`}>€19K</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className={colors.text.muted}>{t('availableParking.labels.range')}</span>
                        <span>€12K - €28K</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className={colors.text.muted}>{t('availableParking.labels.demand')}</span>
                        <span className={`${colors.text.info} font-medium`}>{t('availableParking.demand.medium')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* External Parking */}
              <div className="space-y-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Square className={iconSizes.md} />
                  {t('availableParking.types.external.title')}
                </h2>

                <div className="space-y-3">
                  <div className={`p-4 bg-card ${quick.card} hover:bg-accent/50 transition-colors cursor-pointer`}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-2 ${colors.bg.success}/10 rounded-lg`}>
                        <Building2 className={`${iconSizes.sm} ${colors.text.success}`} />
                      </div>
                      <h3 className="font-medium">{t('availableParking.types.external.covered')}</h3>
                      <span className={`ml-auto ${colors.bg.success}/20 ${colors.text.success} px-2 py-1 rounded text-sm font-medium`}>
                        {t('availableParking.available', { count: 12 })}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className={colors.text.muted}>{t('availableParking.labels.avgPrice')}</span>
                        <span className={`${colors.text.success} font-medium`}>€16K</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className={colors.text.muted}>{t('availableParking.labels.range')}</span>
                        <span>€10K - €25K</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className={colors.text.muted}>{t('availableParking.labels.demand')}</span>
                        <span className={`${colors.text.success} font-medium`}>{t('availableParking.demand.good')}</span>
                      </div>
                    </div>
                  </div>

                  <div className={`p-4 bg-card ${quick.card} hover:bg-accent/50 transition-colors cursor-pointer`}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-2 ${colors.bg.warning}/10 rounded-lg`}>
                        <Square className={`${iconSizes.sm} ${colors.text.warning}`} />
                      </div>
                      <h3 className="font-medium">{t('availableParking.types.external.open')}</h3>
                      <span className={`ml-auto ${colors.bg.warning}/20 ${colors.text.warning} px-2 py-1 rounded text-sm font-medium`}>
                        {t('availableParking.available', { count: 6 })}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className={colors.text.muted}>{t('availableParking.labels.avgPrice')}</span>
                        <span className={`${colors.text.success} font-medium`}>€8K</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className={colors.text.muted}>{t('availableParking.labels.range')}</span>
                        <span>€4K - €12K</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className={colors.text.muted}>{t('availableParking.labels.demand')}</span>
                        <span className={`${colors.text.error} font-medium`}>{t('availableParking.demand.low')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Market Analysis */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Prices by Type */}
              <div className={`p-6 bg-card ${quick.card}`}>
                <div className="flex items-center gap-3 mb-4">
                  <div className={`p-2 ${colors.bg.info}/10 rounded-lg`}>
                    <DollarSign className={`${iconSizes.md} ${colors.text.info}`} />
                  </div>
                  <h3 className="font-semibold">{t('availableParking.analysis.pricesByType')}</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('availableParking.analysis.premium')}</span>
                    <span className={`font-medium ${colors.text.success}`}>€25K - €42K</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('availableParking.analysis.standard')}</span>
                    <span className={`font-medium ${colors.text.info}`}>€12K - €25K</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('availableParking.analysis.economy')}</span>
                    <span className={`font-medium ${colors.text.warning}`}>€4K - €12K</span>
                  </div>
                </div>
              </div>

              {/* Activity */}
              <div className={`p-6 bg-card ${quick.card}`}>
                <div className="flex items-center gap-3 mb-4">
                  <div className={`p-2 ${colors.bg.success}/10 rounded-lg`}>
                    <Eye className={`${iconSizes.md} ${colors.text.success}`} />
                  </div>
                  <h3 className="font-semibold">{t('availableParking.analysis.activity')}</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('availableParking.analysis.activeViews')}</span>
                    <span className={`font-medium ${colors.text.info}`}>31</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('availableParking.analysis.visitRequests')}</span>
                    <span className={`font-medium ${colors.text.success}`}>12</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('availableParking.analysis.underNegotiation')}</span>
                    <span className={`font-medium ${colors.text.warning}`}>7</span>
                  </div>
                </div>
              </div>

              {/* Trends */}
              <div className={`p-6 bg-card ${quick.card}`}>
                <div className="flex items-center gap-3 mb-4">
                  <div className={`p-2 ${colors.bg.warning}/10 rounded-lg`}>
                    <TrendingUp className={`${iconSizes.md} ${colors.text.accent}`} />
                  </div>
                  <h3 className="font-semibold">{t('availableParking.analysis.marketTrends')}</h3>
                </div>
                <div className="space-y-3">
                  <div className="text-sm">
                    <div className={colors.text.muted}>{t('availableParking.analysis.mostPopular')}</div>
                    <div className="font-medium">{t('availableParking.analysis.enclosedUnderground')}</div>
                  </div>
                  <div className="text-sm">
                    <div className={colors.text.muted}>{t('availableParking.analysis.fastestSale')}</div>
                    <div className="font-medium">{t('availableParking.stats.months', { count: 3.4 })}</div>
                  </div>
                  <div className="text-sm">
                    <div className={colors.text.muted}>{t('availableParking.analysis.roi')}</div>
                    <div className={`font-medium ${colors.text.success}`}>{t('availableParking.analysis.annualReturn', { percent: 6 })}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Info Message */}
            <div className={`p-4 bg-muted/50 ${quick.card}`}>
              <div className="flex items-center gap-2 text-sm">
                <Car className={iconSizes.sm} />
                <span className="font-medium">{t('availableParking.title')}</span>
              </div>
              <p className={`text-sm ${colors.text.muted} mt-1`}>
                {t('availableParking.info.description')}
              </p>
            </div>
          </div>
      </PageContainer>
    </TooltipProvider>
  );
}