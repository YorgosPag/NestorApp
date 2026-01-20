'use client';

import React from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { UnifiedDashboard, type DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import {
  DollarSign,
  Package,
  Car,
  CheckCircle,
  ShoppingCart,
  TrendingUp,
  BarChart3,
} from 'lucide-react';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { useIconSizes } from '@/hooks/useIconSizes';

import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

// 🏢 ENTERPRISE: Centralized Unit Icon & Color
const UnitIcon = NAVIGATION_ENTITIES.unit.icon;
const unitColor = NAVIGATION_ENTITIES.unit.color;

export default function SalesPage() {
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();
  // 🏢 ENTERPRISE: i18n support
  const { t } = useTranslation('common');

  // Placeholder stats for Sales - inside component for i18n access
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
    <TooltipProvider>
      <div className={`flex h-screen ${colors.bg.primary}`}>
        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className={`border-b ${colors.bg.primary}/95 backdrop-blur supports-[backdrop-filter]:${colors.bg.primary}/60`}>
            <div className="flex h-14 items-center px-4">
              <div className="flex items-center gap-2">
                <DollarSign className={`${iconSizes.md} text-muted-foreground`} />
                <h1 className="text-lg font-semibold">{t('sales.title')}</h1>
              </div>
              <div className="ml-auto text-sm text-muted-foreground">
                {t('sales.subtitle')}
              </div>
            </div>
          </div>

          {/* Dashboard Stats */}
          <div className="p-6 space-y-6">
            <UnifiedDashboard
              title={t('sales.overview')}
              stats={salesStats}
              variant="modern"
            />

            {/* Navigation Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Διαθέσιμα Section */}
              <div className="space-y-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <ShoppingCart className={iconSizes.md} />
                  {t('sales.sections.availableForSale')}
                </h2>

                <div className="space-y-3">
                  {/* Available Apartments */}
                  <div className={`p-4 bg-card ${quick.card} hover:bg-accent/50 transition-colors cursor-pointer`}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <UnitIcon className={`${iconSizes.sm} ${unitColor}`} />
                      </div>
                      <h3 className="font-medium">{t('sales.cards.apartments.title')}</h3>
                      <span className="ml-auto bg-primary/20 text-primary px-2 py-1 rounded text-sm font-medium">
                        142
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {t('sales.cards.apartments.description')}
                    </p>
                  </div>

                  {/* Available Storage */}
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
                    <p className="text-sm text-muted-foreground">
                      {t('sales.cards.storage.description')}
                    </p>
                  </div>

                  {/* Available Parking */}
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
                    <p className="text-sm text-muted-foreground">
                      {t('sales.cards.parking.description')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Πωλημένα Section */}
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
                      <span className="text-sm text-muted-foreground">{t('sales.sold.cards.apartments.title')}</span>
                      <span className="font-medium">{t('sales.cards.completedSales.apartmentsSold', { count: 344 })}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">{t('sales.sold.cards.storage.title')}</span>
                      <span className="font-medium">{t('sales.cards.completedSales.storageSold', { count: 235 })}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">{t('sales.sold.cards.parking.title')}</span>
                      <span className="font-medium">{t('sales.cards.completedSales.parkingSold', { count: 344 })}</span>
                    </div>
                    <div className="border-t pt-3 mt-3">
                      <div className="flex justify-between items-center font-semibold">
                        <span>{t('sales.cards.completedSales.totalLabel')}</span>
                        <span>{t('sales.cards.completedSales.totalProperties', { count: 568 })}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm text-muted-foreground">
                        <span>{t('sales.cards.completedSales.totalValueLabel')}</span>
                        <span>€18.4M</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Info Message */}
            <div className={`p-4 bg-muted/50 ${quick.card}`}>
              <div className="flex items-center gap-2 text-sm">
                <DollarSign className={iconSizes.sm} />
                <span className="font-medium">{t('sales.info.title')}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {t('sales.info.description')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}