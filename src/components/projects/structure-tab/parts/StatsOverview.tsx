'use client';

/**
 * 🏢 ENTERPRISE: Stats Overview Component
 *
 * Displays project statistics for all building spaces:
 * - Units (Μονάδες)
 * - Storage (Αποθήκες)
 * - Parking (Θέσεις Στάθμευσης)
 *
 * @module components/projects/structure-tab/parts/StatsOverview
 */

import React from 'react';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config/navigation-entities';
import { cn } from '@/lib/utils';
import type { ProjectTotals } from '../utils/selectors';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

type StatsOverviewProps = ProjectTotals;

export function StatsOverview({
  totalUnits,
  soldUnits,
  unitsArea,
  totalStorages,
  soldStorages,
  storagesArea,
  totalParkingSpots,
  soldParkingSpots,
  parkingArea,
  totalSpaces,
  totalArea,
  soldPct
}: StatsOverviewProps) {
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('projects');
  const colors = useSemanticColors();
  const { quick } = useBorderTokens();

  // Stats card component
  const StatCard = ({
    icon: Icon,
    iconColor,
    label,
    value,
    subValue,
    valueColor
  }: {
    icon: React.ElementType;
    iconColor: string;
    label: string;
    value: string | number;
    subValue?: string;
    valueColor: string;
  }) => (
    <div className={cn(colors.bg.primary, 'p-4', quick.card)}>
      <div className="flex items-center gap-2 mb-2">
        <Icon size={18} className={iconColor} />
        <span className={`text-sm ${colors.text.muted}`}>{label}</span>
      </div>
      <div className={`text-2xl font-bold ${valueColor}`}>{value}</div>
      {subValue && (
        <div className={`text-xs ${colors.text.muted} mt-1`}>{subValue}</div>
      )}
    </div>
  );

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {/* Units */}
      <StatCard
        icon={NAVIGATION_ENTITIES.unit.icon}
        iconColor={NAVIGATION_ENTITIES.unit.color}
        label={t('structure.stats.units', 'Μονάδες')}
        value={totalUnits}
        subValue={`${soldUnits} ${t('structure.stats.sold', 'πωλημένες')} • ${unitsArea.toFixed(0)} m²`}
        valueColor={colors.text.info}
      />

      {/* Storage */}
      <StatCard
        icon={NAVIGATION_ENTITIES.storage.icon}
        iconColor={NAVIGATION_ENTITIES.storage.color}
        label={t('structure.stats.storages', 'Αποθήκες')}
        value={totalStorages}
        subValue={`${soldStorages} ${t('structure.stats.sold', 'πωλημένες')} • ${storagesArea.toFixed(0)} m²`}
        valueColor={colors.text.warning}
      />

      {/* Parking */}
      <StatCard
        icon={NAVIGATION_ENTITIES.parking.icon}
        iconColor={NAVIGATION_ENTITIES.parking.color}
        label={t('structure.stats.parking', 'Θέσεις')}
        value={totalParkingSpots}
        subValue={`${soldParkingSpots} ${t('structure.stats.sold', 'πωλημένες')} • ${parkingArea.toFixed(0)} m²`}
        valueColor={colors.text.accent}
      />

      {/* Total / Sales % */}
      <div className={cn(colors.bg.primary, 'p-4', quick.card)}>
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-sm ${colors.text.muted}`}>
            {t('structure.stats.salesPct', '% Πωλήσεων')}
          </span>
        </div>
        <div className="text-2xl font-bold text-orange-600">
          {soldPct.toFixed(1)}%
        </div>
        <div className={`text-xs ${colors.text.muted} mt-1`}>
          {t('structure.stats.totalSpaces', 'Σύνολο')}: {totalSpaces} • {totalArea.toFixed(0)} m²
        </div>
      </div>
    </div>
  );
}
