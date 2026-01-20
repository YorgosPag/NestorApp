// 🌐 i18n: All labels converted to i18n keys - 2026-01-19
'use client';

import React from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { UnifiedDashboard, type DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import {
  Package,
  DollarSign,
  Warehouse,
  Archive,
  TrendingUp,
  Eye,
  MapPin,
  Calendar,
} from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PageContainer } from '@/core/containers';
import { useTranslation } from 'react-i18next';

export default function AvailableStoragePage() {
  const { t } = useTranslation('sales');
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();

  // 🌐 i18n: Stats use i18n keys
  const storageStats: DashboardStat[] = [
    {
      title: t('availableStorage.stats.available'),
      value: '89',
      description: t('availableStorage.stats.forSaleNow'),
      icon: Package,
      color: 'orange',
      trend: { value: -3, label: t('common.decrease') }
    },
    {
      title: t('availableStorage.stats.avgPrice'),
      value: '€45K',
      description: t('availableStorage.stats.priceAverage'),
      icon: DollarSign,
      color: 'green',
      trend: { value: 8, label: t('common.increase') }
    },
    {
      title: t('availableStorage.stats.interest'),
      value: '23',
      description: t('availableStorage.stats.activeViews'),
      icon: Eye,
      color: 'purple',
      trend: { value: 15, label: t('common.increase') }
    },
    {
      title: t('availableStorage.stats.avgTime'),
      value: t('availableStorage.stats.months', { count: 6.8 }),
      description: t('availableStorage.stats.onMarket'),
      icon: Calendar,
      color: 'blue',
      trend: { value: -5, label: t('common.decrease') }
    }
  ];
  return (
    <TooltipProvider>
      <PageContainer fullScreen ariaLabel={t('availableStorage.pageLabel')}>
        {/* Header */}
          <div className={`border-b ${colors.bg.primary}/95 backdrop-blur supports-[backdrop-filter]:${colors.bg.primary}/60`}>
            <div className="flex h-14 items-center px-4">
              <div className="flex items-center gap-2">
                <Package className={`${iconSizes.md} text-muted-foreground`} />
                <h1 className="text-lg font-semibold">{t('availableStorage.title')}</h1>
              </div>
              <div className="ml-auto text-sm text-muted-foreground">
                {t('availableStorage.subtitle')}
              </div>
            </div>
          </div>

          {/* Dashboard Stats - Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <UnifiedDashboard
              title={t('availableStorage.overview')}
              stats={storageStats}
              variant="modern"
            />

            {/* Storage Types */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Large Storage */}
              <div className="space-y-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Warehouse className={iconSizes.md} />
                  {t('availableStorage.types.large.title')}
                </h2>

                <div className="space-y-3">
                  <div className={`p-4 bg-card ${quick.card} hover:bg-accent/50 transition-colors cursor-pointer`}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-2 ${colors.bg.warning}/10 rounded-lg`}>
                        <Warehouse className={`${iconSizes.sm} ${colors.text.warning}`} />
                      </div>
                      <h3 className="font-medium">{t('availableStorage.types.large.basement')}</h3>
                      <span className={`ml-auto ${colors.bg.warning}/20 ${colors.text.warning} px-2 py-1 rounded text-sm font-medium`}>
                        {t('availableStorage.available', { count: 23 })}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{t('availableStorage.labels.avgPrice')}</span>
                        <span className={`${colors.text.success} font-medium`}>€68K</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{t('availableStorage.labels.sqmRange')}</span>
                        <span>50-120 {t('common.sqm')}</span>
                      </div>
                    </div>
                  </div>

                  <div className={`p-4 bg-card ${quick.card} hover:bg-accent/50 transition-colors cursor-pointer`}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-2 ${colors.bg.info}/10 rounded-lg`}>
                        <Warehouse className={`${iconSizes.sm} ${colors.text.info}`} />
                      </div>
                      <h3 className="font-medium">{t('availableStorage.types.large.groundFloor')}</h3>
                      <span className={`ml-auto ${colors.bg.info}/20 ${colors.text.info} px-2 py-1 rounded text-sm font-medium`}>
                        {t('availableStorage.available', { count: 18 })}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{t('availableStorage.labels.avgPrice')}</span>
                        <span className={`${colors.text.success} font-medium`}>€85K</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{t('availableStorage.labels.sqmRange')}</span>
                        <span>55-95 {t('common.sqm')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Small Storage */}
              <div className="space-y-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Archive className={iconSizes.md} />
                  {t('availableStorage.types.small.title')}
                </h2>

                <div className="space-y-3">
                  <div className={`p-4 bg-card ${quick.card} hover:bg-accent/50 transition-colors cursor-pointer`}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-2 ${colors.bg.warning}/10 rounded-lg`}>
                        <Archive className={`${iconSizes.sm} ${colors.text.primary}`} />
                      </div>
                      <h3 className="font-medium">{t('availableStorage.types.small.basement')}</h3>
                      <span className={`ml-auto ${colors.bg.warning}/20 ${colors.text.warning} px-2 py-1 rounded text-sm font-medium`}>
                        {t('availableStorage.available', { count: 31 })}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{t('availableStorage.labels.avgPrice')}</span>
                        <span className={`${colors.text.success} font-medium`}>€28K</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{t('availableStorage.labels.sqmRange')}</span>
                        <span>8-35 {t('common.sqm')}</span>
                      </div>
                    </div>
                  </div>

                  <div className={`p-4 bg-card ${quick.card} hover:bg-accent/50 transition-colors cursor-pointer`}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-2 ${colors.bg.success}/10 rounded-lg`}>
                        <Archive className={`${iconSizes.sm} ${colors.text.success}`} />
                      </div>
                      <h3 className="font-medium">{t('availableStorage.types.small.groundFloor')}</h3>
                      <span className={`ml-auto ${colors.bg.success}/20 ${colors.text.success} px-2 py-1 rounded text-sm font-medium`}>
                        {t('availableStorage.available', { count: 17 })}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{t('availableStorage.labels.avgPrice')}</span>
                        <span className={`${colors.text.success} font-medium`}>€35K</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{t('availableStorage.labels.sqmRange')}</span>
                        <span>12-45 {t('common.sqm')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Price Analysis & Market Activity */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Price Analysis */}
              <div className="space-y-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <DollarSign className={iconSizes.md} />
                  {t('availableStorage.analysis.priceAnalysis')}
                </h2>

                <div className={`p-6 bg-card ${quick.card}`}>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">{t('availableStorage.analysis.economy')}</span>
                      <div className="text-right">
                        <div className={`font-medium ${colors.text.success}`}>{t('availableStorage.analysis.storages', { count: 34 })}</div>
                        <div className="text-xs text-muted-foreground">€18K - €29K</div>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">{t('availableStorage.analysis.medium')}</span>
                      <div className="text-right">
                        <div className={`font-medium ${colors.text.info}`}>{t('availableStorage.analysis.storages', { count: 38 })}</div>
                        <div className="text-xs text-muted-foreground">€35K - €58K</div>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">{t('availableStorage.analysis.premium')}</span>
                      <div className="text-right">
                        <div className={`font-medium ${colors.text.primary}`}>{t('availableStorage.analysis.storages', { count: 17 })}</div>
                        <div className="text-xs text-muted-foreground">€65K - €125K</div>
                      </div>
                    </div>
                    <div className="border-t pt-3 mt-3">
                      <div className="flex justify-between items-center font-semibold">
                        <span>{t('availableStorage.analysis.avgPricePerSqm')}</span>
                        <span className={colors.text.success}>€1,450/{t('common.sqm')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Market Activity */}
              <div className="space-y-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Eye className={iconSizes.md} />
                  {t('availableStorage.analysis.marketActivity')}
                </h2>

                <div className={`p-6 bg-card ${quick.card}`}>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">{t('availableStorage.analysis.activeViews')}</span>
                      <span className={`font-medium ${colors.text.info}`}>{t('availableStorage.analysis.views', { count: 23 })}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">{t('availableStorage.analysis.visitRequests')}</span>
                      <span className={`font-medium ${colors.text.success}`}>{t('availableStorage.analysis.requests', { count: 8 })}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">{t('availableStorage.analysis.underNegotiation')}</span>
                      <span className={`font-medium ${colors.text.warning}`}>{t('availableStorage.analysis.storages', { count: 5 })}</span>
                    </div>
                    <div className="border-t pt-3 mt-3">
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">{t('availableStorage.analysis.mostPopular')}</span>
                          <span>{t('availableStorage.analysis.basementSmall')}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">{t('availableStorage.analysis.avgSaleTime')}</span>
                          <span className="font-medium">{t('availableStorage.stats.months', { count: 6.8 })}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Info Message */}
            <div className={`p-4 bg-muted/50 ${quick.card}`}>
              <div className="flex items-center gap-2 text-sm">
                <Package className={iconSizes.sm} />
                <span className="font-medium">{t('availableStorage.title')}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {t('availableStorage.info.description')}
              </p>
            </div>
          </div>
      </PageContainer>
    </TooltipProvider>
  );
}