'use client';

/**
 * @module sales/hub
 * @enterprise Sales Hub Dashboard
 * @lazy ADR-294 Batch 3 — Extracted for dynamic import
 */

import React from 'react';
import { UnifiedDashboard, type DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import {
  DollarSign,
  Package,
  Car,
  CheckCircle,
  ShoppingCart,
  TrendingUp,
} from 'lucide-react';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { ModuleBreadcrumb } from '@/components/shared/ModuleBreadcrumb';
import '@/lib/design-system';

const PropertyIcon = NAVIGATION_ENTITIES.property.icon;
const propertyColor = NAVIGATION_ENTITIES.property.color;

export function SalesHubPageContent() {
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();
  const { t } = useTranslation(['common', 'common-account', 'common-actions', 'common-empty-states', 'common-navigation', 'common-photos', 'common-sales', 'common-shared', 'common-status', 'common-validation']);

  const salesStats: DashboardStat[] = [
    {
      title: t('sales.stats.totalSaleable'),
      value: '892',
      description: t('sales.stats.allAvailableProperties'),
      icon: ShoppingCart,
      color: 'blue',
      trend: { value: 12, label: t('sales.stats.increase') }
    },
    {
      title: t('sales.stats.available'),
      value: '324',
      description: t('sales.stats.forSale'),
      icon: DollarSign,
      color: 'green',
      trend: { value: -5, label: t('sales.stats.decrease') }
    },
    {
      title: t('sales.stats.sold'),
      value: '568',
      description: t('sales.stats.completedSales'),
      icon: CheckCircle,
      color: 'purple',
      trend: { value: 18, label: t('sales.stats.increase') }
    },
    {
      title: t('sales.stats.totalValue'),
      value: '€24.8M',
      description: t('sales.stats.portfolioValue'),
      icon: TrendingUp,
      color: 'orange',
      trend: { value: 8, label: t('sales.stats.increase') }
    }
  ];

  return (
    <div className={`flex h-screen ${colors.bg.primary}`}>
        <div className="flex-1 flex flex-col">
          <div className={`border-b ${colors.bg.primary}/95 backdrop-blur supports-[backdrop-filter]:${colors.bg.primary}/60`}>
            <ModuleBreadcrumb className="px-4 pt-2" />
            <div className="flex h-14 items-center px-4">
              <div className="flex items-center gap-2">
                <DollarSign className={`${iconSizes.md} ${colors.text.muted}`} />
                <h1 className="text-lg font-semibold">{t('sales.title')}</h1>
              </div>
              <div className={cn("ml-auto text-sm", colors.text.muted)}>
                {t('sales.subtitle')}
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <UnifiedDashboard
              title={t('sales.overview')}
              stats={salesStats}
              variant="modern"
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <ShoppingCart className={iconSizes.md} />
                  {t('sales.sections.availableForSale')}
                </h2>

                <div className="space-y-3">
                  <div className={`p-4 bg-card ${quick.card} hover:bg-accent/50 transition-colors cursor-pointer`}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <PropertyIcon className={`${iconSizes.sm} ${propertyColor}`} />
                      </div>
                      <h3 className="font-medium">{t('sales.cards.apartments.title')}</h3>
                      <span className="ml-auto bg-primary/20 text-primary px-2 py-1 rounded text-sm font-medium">
                        142
                      </span>
                    </div>
                    <p className={cn("text-sm", colors.text.muted)}>
                      {t('sales.cards.apartments.description')}
                    </p>
                  </div>

                  <div className={`p-4 bg-card ${quick.card} hover:bg-accent/50 transition-colors cursor-pointer`}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-2 ${colors.bg.warning}/10 rounded-lg`}>
                        <Package className={`${iconSizes.sm} ${colors.text.warning}`} />
                      </div>
                      <h3 className="font-medium">{t('sales.cards.storage.title')}</h3>
                      <span className={`ml-auto ${colors.bg.warning}/20 ${colors.text.warning} px-2 py-1 rounded text-sm font-medium`}>
                        89
                      </span>
                    </div>
                    <p className={cn("text-sm", colors.text.muted)}>
                      {t('sales.cards.storage.description')}
                    </p>
                  </div>

                  <div className={`p-4 bg-card ${quick.card} hover:bg-accent/50 transition-colors cursor-pointer`}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-2 ${colors.bg.info}/10 rounded-lg`}>
                        <Car className={`${iconSizes.sm} ${colors.text.info}`} />
                      </div>
                      <h3 className="font-medium">{t('sales.cards.parking.title')}</h3>
                      <span className={`ml-auto ${colors.bg.info}/20 ${colors.text.info} px-2 py-1 rounded text-sm font-medium`}>
                        93
                      </span>
                    </div>
                    <p className={cn("text-sm", colors.text.muted)}>
                      {t('sales.cards.parking.description')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <CheckCircle className={iconSizes.md} />
                  {t('sales.sections.soldProperties')}
                </h2>

                <div className={`p-6 bg-card ${quick.card}`}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`p-2 ${colors.bg.success}/10 rounded-lg`}>
                      <CheckCircle className={`${iconSizes.md} ${colors.text.success}`} />
                    </div>
                    <h3 className="font-semibold">{t('sales.cards.completedSales.title')}</h3>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className={cn("text-sm", colors.text.muted)}>{t('sales.sold.cards.apartments.title')}</span>
                      <span className="font-medium">{t('sales.cards.completedSales.apartmentsSold', { count: 344 })}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className={cn("text-sm", colors.text.muted)}>{t('sales.sold.cards.storage.title')}</span>
                      <span className="font-medium">{t('sales.cards.completedSales.storageSold', { count: 235 })}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className={cn("text-sm", colors.text.muted)}>{t('sales.sold.cards.parking.title')}</span>
                      <span className="font-medium">{t('sales.cards.completedSales.parkingSold', { count: 344 })}</span>
                    </div>
                    <div className="border-t pt-3 mt-3">
                      <div className="flex justify-between items-center font-semibold">
                        <span>{t('sales.cards.completedSales.totalLabel')}</span>
                        <span>{t('sales.cards.completedSales.totalProperties', { count: 568 })}</span>
                      </div>
                      <div className={cn("flex justify-between items-center text-sm", colors.text.muted)}>
                        <span>{t('sales.cards.completedSales.totalValueLabel')}</span>
                        <span>€18.4M</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className={`p-4 bg-muted/50 ${quick.card}`}>
              <div className="flex items-center gap-2 text-sm">
                <DollarSign className={iconSizes.sm} />
                <span className="font-medium">{t('sales.info.title')}</span>
              </div>
              <p className={cn("text-sm mt-1", colors.text.muted)}>
                {t('sales.info.description')}
              </p>
            </div>
          </div>
        </div>
      </div>
  );
}

export default SalesHubPageContent;
