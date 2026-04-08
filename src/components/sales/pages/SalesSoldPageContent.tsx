/* eslint-disable custom/no-hardcoded-strings */
'use client';

/**
 * @module sales/sold
 * @enterprise Sold Properties Dashboard
 * @lazy ADR-294 Batch 3 — Extracted for dynamic import
 */

import React from 'react';
import { UnifiedDashboard, type DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import {
  CheckCircle,
  DollarSign,
  Calendar,
  TrendingUp,
  Package,
  Car,
  BarChart3,
  Users,
} from 'lucide-react';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import '@/lib/design-system';

const PropertyIcon = NAVIGATION_ENTITIES.property.icon;
const propertyColor = NAVIGATION_ENTITIES.property.color;

export function SalesSoldPageContent() {
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();
  const { t } = useTranslation('common');

  const soldStats: DashboardStat[] = [
    {
      title: t('sales.sold.stats.totalSales'),
      value: '568',
      description: t('sales.sold.stats.completedSales'),
      icon: CheckCircle,
      color: 'green',
      trend: { value: 18, label: t('sales.stats.increase') }
    },
    {
      title: t('sales.sold.stats.totalRevenue'),
      value: '€18.4M',
      description: t('sales.sold.stats.totalSalesValue'),
      icon: DollarSign,
      color: 'blue',
      trend: { value: 22, label: t('sales.stats.increase') }
    },
    {
      title: t('sales.sold.stats.avgSaleTime'),
      value: '4.8 μήνες',
      description: t('sales.sold.stats.marketAverage'),
      icon: Calendar,
      color: 'orange',
      trend: { value: -8, label: t('sales.sold.stats.improvement') }
    },
    {
      title: t('sales.sold.stats.salesThisYear', { year: 2024 }),
      value: '89',
      description: t('sales.sold.stats.yearToDate'),
      icon: TrendingUp,
      color: 'purple',
      trend: { value: 15, label: t('sales.stats.increase') }
    }
  ];

  return (
    <div className={`flex h-screen ${colors.bg.primary}`}>
        <div className="flex-1 flex flex-col">
          <div className={`border-b ${colors.bg.primary}/95 backdrop-blur supports-[backdrop-filter]:${colors.bg.primary}/60`}>
            <div className="flex h-14 items-center px-4">
              <div className="flex items-center gap-2">
                <CheckCircle className={`${iconSizes.md} ${colors.text.muted}`} />
                <h1 className="text-lg font-semibold">{t('sales.sold.title')}</h1>
              </div>
              <div className={cn("ml-auto text-sm", colors.text.muted)}>
                {t('sales.sold.subtitle')}
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <UnifiedDashboard
              title={t('sales.sold.overview')}
              stats={soldStats}
              variant="modern"
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className={`p-6 bg-card ${quick.card} hover:bg-accent/50 transition-colors cursor-pointer`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 ${colors.bg.success}/10 rounded-lg`}>
                    <PropertyIcon className={`${iconSizes.md} ${propertyColor}`} />
                  </div>
                  <h3 className="font-semibold">{t('sales.sold.cards.apartments.title')}</h3>
                </div>
                <div className="text-3xl font-bold mb-2">344</div>
                <p className={cn("text-sm mb-3", colors.text.muted)}>
                  {t('sales.sold.cards.apartments.description')}
                </p>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className={colors.text.muted}>{t('sales.sold.cards.totalRevenue')}</span>
                    <span className={`font-semibold ${colors.text.success}`}>€12.8M</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className={colors.text.muted}>{t('sales.sold.cards.avgPrice')}</span>
                    <span className="font-medium">€372K</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className={colors.text.muted}>{t('sales.sold.cards.avgTime')}</span>
                    <span className="font-medium">{t('units.monthsValue', { value: 4.2 })}</span>
                  </div>
                </div>
              </div>

              <div className={`p-6 bg-card ${quick.card} hover:bg-accent/50 transition-colors cursor-pointer`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 ${colors.bg.warning}/10 rounded-lg`}>
                    <Package className={`${iconSizes.md} ${colors.text.warning}`} />
                  </div>
                  <h3 className="font-semibold">{t('sales.sold.cards.storage.title')}</h3>
                </div>
                <div className="text-3xl font-bold mb-2">235</div>
                <p className={cn("text-sm mb-3", colors.text.muted)}>
                  {t('sales.sold.cards.storage.description')}
                </p>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className={colors.text.muted}>{t('sales.sold.cards.totalRevenue')}</span>
                    <span className={`font-semibold ${colors.text.success}`}>€3.2M</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className={colors.text.muted}>{t('sales.sold.cards.avgPrice')}</span>
                    <span className="font-medium">€36K</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className={colors.text.muted}>{t('sales.sold.cards.avgTime')}</span>
                    <span className="font-medium">{t('units.monthsValue', { value: 6.1 })}</span>
                  </div>
                </div>
              </div>

              <div className={`p-6 bg-card ${quick.card} hover:bg-accent/50 transition-colors cursor-pointer`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 ${colors.bg.info}/10 rounded-lg`}>
                    <Car className={`${iconSizes.md} ${colors.text.info}`} />
                  </div>
                  <h3 className="font-semibold">{t('sales.sold.cards.parking.title')}</h3>
                </div>
                <div className="text-3xl font-bold mb-2">189</div>
                <p className={cn("text-sm mb-3", colors.text.muted)}>
                  {t('sales.sold.cards.parking.description')}
                </p>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className={colors.text.muted}>{t('sales.sold.cards.totalRevenue')}</span>
                    <span className={`font-semibold ${colors.text.success}`}>€2.4M</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className={colors.text.muted}>{t('sales.sold.cards.avgPrice')}</span>
                    <span className="font-medium">€21K</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className={colors.text.muted}>{t('sales.sold.cards.avgTime')}</span>
                    <span className="font-medium">{t('units.monthsValue', { value: 3.8 })}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <BarChart3 className={iconSizes.md} />
                  {t('sales.sold.performance.title')}
                </h2>

                <div className="space-y-3">
                  <div className={`p-4 bg-card ${quick.card}`}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium">{t('sales.sold.performance.yearToDate', { year: 2024 })}</span>
                      <span className={`${colors.bg.success}/20 ${colors.text.success} px-2 py-1 rounded text-sm font-medium`}>
                        {t('sales.sold.performance.sales', { count: 89 })}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className={colors.text.muted}>{t('sales.sold.performance.revenue')}</span>
                        <span className={`${colors.text.success} font-medium`}>€3.2M</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className={colors.text.muted}>{t('sales.sold.performance.avgPrice')}</span>
                        <span>€395K</span>
                      </div>
                    </div>
                  </div>

                  <div className={`p-4 bg-card ${quick.card}`}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium">2023</span>
                      <span className={`${colors.bg.info}/20 ${colors.text.info} px-2 py-1 rounded text-sm font-medium`}>
                        {t('sales.sold.performance.sales', { count: 156 })}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className={colors.text.muted}>{t('sales.sold.performance.revenue')}</span>
                        <span className={`${colors.text.success} font-medium`}>€5.8M</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className={colors.text.muted}>{t('sales.sold.performance.avgPrice')}</span>
                        <span>€372K</span>
                      </div>
                    </div>
                  </div>

                  <div className={`p-4 bg-card ${quick.card}`}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium">2022</span>
                      <span className={`${colors.bg.warning}/20 ${colors.text.warning} px-2 py-1 rounded text-sm font-medium`}>
                        {t('sales.sold.performance.sales', { count: 198 })}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className={colors.text.muted}>{t('sales.sold.performance.revenue')}</span>
                        <span className={`${colors.text.success} font-medium`}>€6.8M</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className={colors.text.muted}>{t('sales.sold.performance.avgPrice')}</span>
                        <span>€344K</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Users className={iconSizes.md} />
                  {t('sales.sold.marketInsights.title')}
                </h2>

                <div className={`p-6 bg-card ${quick.card}`}>
                  <h3 className="font-semibold mb-4">{t('sales.sold.marketInsights.topBuyerCategories')}</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className={cn("text-sm", colors.text.muted)}>{t('sales.sold.marketInsights.privateInvestors')}</span>
                      <div className="text-right">
                        <div className="font-medium">{t('sales.sold.performance.sales', { count: 234 })}</div>
                        <div className={cn("text-xs", colors.text.muted)}>{t('sales.sold.marketInsights.ofTotal', { percent: 41 })}</div>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className={cn("text-sm", colors.text.muted)}>{t('sales.sold.marketInsights.developmentCompanies')}</span>
                      <div className="text-right">
                        <div className="font-medium">{t('sales.sold.performance.sales', { count: 189 })}</div>
                        <div className={cn("text-xs", colors.text.muted)}>{t('sales.sold.marketInsights.ofTotal', { percent: 33 })}</div>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className={cn("text-sm", colors.text.muted)}>{t('sales.sold.marketInsights.familiesOwnerOccupied')}</span>
                      <div className="text-right">
                        <div className="font-medium">{t('sales.sold.performance.sales', { count: 145 })}</div>
                        <div className={cn("text-xs", colors.text.muted)}>{t('sales.sold.marketInsights.ofTotal', { percent: 26 })}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={`p-6 bg-card ${quick.card}`}>
                  <h3 className="font-semibold mb-4">{t('sales.sold.marketInsights.performanceMetrics')}</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className={cn("text-sm", colors.text.muted)}>{t('sales.sold.marketInsights.successRate')}</span>
                      <span className={`font-medium ${colors.text.success}`}>78%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className={cn("text-sm", colors.text.muted)}>{t('sales.sold.marketInsights.avgDiscount')}</span>
                      <span className={`font-medium ${colors.text.warning}`}>-3.2%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className={cn("text-sm", colors.text.muted)}>{t('sales.sold.marketInsights.fastestSale')}</span>
                      <span className={`font-medium ${colors.text.info}`}>{t('sales.sold.marketInsights.days', { count: 8 })}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className={cn("text-sm", colors.text.muted)}>{t('sales.sold.marketInsights.slowestSale')}</span>
                      <span className={`font-medium ${colors.text.error}`}>{t('sales.sold.marketInsights.months', { count: 18 })}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className={`p-4 bg-muted/50 ${quick.card}`}>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className={iconSizes.sm} />
                <span className="font-medium">{t('sales.sold.info.title')}</span>
              </div>
              <p className={cn("text-sm mt-1", colors.text.muted)}>
                {t('sales.sold.info.description')}
              </p>
            </div>
          </div>
        </div>
      </div>
  );
}

export default SalesSoldPageContent;
