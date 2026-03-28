'use client';

import React from 'react';
import { formatCurrency } from '@/lib/intl-utils';
import type { Storage } from '@/types/storage/contracts';
import { BarChart3, TrendingUp, DollarSign, Square } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { cn } from '@/lib/utils';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { efficiencyProgressStyle, getEfficiencyColorClass } from './StorageStatsTab.styles';
import { getStatusColor } from '@/lib/design-system';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

interface StorageStatsTabProps {
  storage: Storage;
}

function getEfficiencyScore(storage: Storage): number {
  // Calculate a simple efficiency score based on price per m² and status
  if (!storage.price || storage.status === 'maintenance') return 0;

  const pricePerSqm = storage.price / storage.area;
  const statusMultiplier = storage.status === 'occupied' ? 1.2 :
                          storage.status === 'reserved' ? 1.1 : 1.0;

  // Normalize to 0-100 scale (assuming €500/m² is max efficiency)
  return Math.min(100, Math.round((pricePerSqm / 500) * 100 * statusMultiplier));
}

export function StorageStatsTab({ storage }: StorageStatsTabProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  // 🏢 ENTERPRISE: i18n support
  const { t } = useTranslation('storage');
  const pricePerSqm = storage.price && storage.area ? storage.price / storage.area : 0;
  const efficiencyScore = getEfficiencyScore(storage);

  const stats = [
    {
      icon: Square,
      label: t('stats.metrics.totalArea'),
      value: `${storage.area} m²`,
      color: getStatusColor('pending', 'text')
    },
    {
      icon: DollarSign,
      label: t('stats.metrics.totalValue'),
      value: storage.price ? formatCurrency(storage.price) : t('stats.notSet'),
      color: getStatusColor('available', 'text')
    },
    {
      icon: TrendingUp,
      label: t('stats.metrics.pricePerSqm'),
      value: pricePerSqm ? formatCurrency(pricePerSqm) : t('stats.notCalculated'),
      color: getStatusColor('completed', 'text')
    },
    {
      icon: BarChart3,
      label: t('stats.metrics.efficiencyScore'),
      value: `${efficiencyScore}%`,
      color: efficiencyScore > 70 ? getStatusColor('available', 'text') :
             efficiencyScore > 40 ? getStatusColor('reserved', 'text') : getStatusColor('error', 'text')
    }
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Statistics Cards */}
      <section>
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <BarChart3 className={iconSizes.md} />
          {t('stats.title')}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat, index) => {
            const IconComponent = stat.icon;
            return (
              <div key={index} className="bg-card border rounded-lg p-4 text-center">
                <IconComponent className={`${iconSizes.xl} mx-auto mb-2 ${stat.color}`} />
                <p className="text-lg font-semibold">{stat.value}</p>
                <p className={cn("text-sm", colors.text.muted)}>{stat.label}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Detailed Analysis */}
      <section>
        <h3 className="font-semibold mb-4">{t('stats.detailedAnalysis')}</h3>
        <div className="bg-card border rounded-lg p-4 space-y-4">
          {/* Efficiency Breakdown */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">{t('stats.efficiency')}</span>
              <span className="text-sm font-medium">{efficiencyScore}%</span>
            </div>
            <div className="w-full bg-secondary rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${getEfficiencyColorClass(efficiencyScore)}`}
                style={efficiencyProgressStyle(efficiencyScore)}
              />
            </div>
          </div>

          {/* Status Analysis */}
          <div>
            <span className="text-sm font-medium">{t('stats.statusAnalysis.title')}</span>
            <p className={cn("text-sm mt-1", colors.text.muted)}>
              {t(`stats.statusAnalysis.${storage.status || 'maintenance'}`)}
            </p>
          </div>

          {/* Price Analysis */}
          {storage.price && (
            <div>
              <span className="text-sm font-medium">{t('stats.financialAnalysis.title')}</span>
              <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className={colors.text.muted}>{t('stats.financialAnalysis.totalValue')}</span>
                  <span className="font-medium ml-2">{formatCurrency(storage.price)}</span>
                </div>
                <div>
                  <span className={colors.text.muted}>{t('stats.financialAnalysis.costPerSqm')}</span>
                  <span className="font-medium ml-2">{formatCurrency(pricePerSqm)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Technical Details */}
      <section>
        <h3 className="font-semibold mb-4">{t('stats.technicalSpecs')}</h3>
        <div className="bg-card border rounded-lg p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className={colors.text.muted}>{t('stats.technicalFields.type')}</span>
              <span className="font-medium ml-2">
                {t(`stats.types.${storage.type || 'unknown'}`)}
              </span>
            </div>
            <div>
              <span className={colors.text.muted}>{t('stats.technicalFields.building')}</span>
              <span className="font-medium ml-2">{storage.building}</span>
            </div>
            <div>
              <span className={colors.text.muted}>{t('stats.technicalFields.floor')}</span>
              <span className="font-medium ml-2">{storage.floor}</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
