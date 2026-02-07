'use client';

/**
 * 🏢 ENTERPRISE: Building Node Component
 *
 * Displays a building with expandable tabs for:
 * - Units (Μονάδες)
 * - Storage (Αποθήκες)
 * - Parking (Θέσεις Στάθμευσης)
 *
 * Architecture (from BuildingSpacesTabs):
 * ❌ NO: Parking/Storage as "attachments" or children of Units
 * ✅ YES: Parking/Storage/Units as equal parallel categories in Building context
 *
 * @module components/projects/structure-tab/parts/BuildingNode
 */

import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
// 🏢 ENTERPRISE: Using centralized entity config for icons/colors
import { NAVIGATION_ENTITIES } from '@/components/navigation/config/navigation-entities';
import { cn } from '@/lib/utils';
import { UnitNode } from './UnitNode';
import { StorageNode } from './StorageNode';
import { ParkingNode } from './ParkingNode';
import { HOVER_BACKGROUND_EFFECTS, TRANSITION_PRESETS } from '@/components/ui/effects';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useTypography } from '@/hooks/useTypography';
import { useIconSizes } from '@/hooks/useIconSizes';
import type { BuildingModel, StorageModel, ParkingModel, UnitModel } from '../types';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

// =============================================================================
// TYPES
// =============================================================================

/** Tab types for building spaces */
type SpaceTab = 'units' | 'storage' | 'parking';

// =============================================================================
// COMPONENT
// =============================================================================

export const BuildingNode = ({ building }: { building: BuildingModel }) => {
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('projects');
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<SpaceTab>('units');
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();
  const spacing = useSpacingTokens();
  const typography = useTypography();
  const iconSizes = useIconSizes();

  // ==========================================================================
  // COMPUTED VALUES
  // ==========================================================================

  const units = (building.units || []) as UnitModel[];
  const storages = (building.storages || []) as StorageModel[];
  const parkingSpots = (building.parkingSpots || []) as ParkingModel[];

  // Unit stats
  const soldUnits = units.filter((u) => u.status === 'sold').length;
  const totalUnits = units.length;
  const totalArea = units.reduce((sum: number, u) => sum + (u.area || 0), 0);
  const soldArea = units.filter((u) => u.status === 'sold').reduce((sum: number, u) => sum + (u.area || 0), 0);

  // Total counts for subtitle
  const totalStorages = storages.length;
  const totalParkingSpots = parkingSpots.length;

  // ==========================================================================
  // TAB CONFIGURATION
  // ==========================================================================

  const tabs = useMemo(() => [
    {
      id: 'units' as SpaceTab,
      label: t('structure.tabs.units', 'Μονάδες'),
      icon: NAVIGATION_ENTITIES.unit.icon,
      iconColor: NAVIGATION_ENTITIES.unit.color,
      count: totalUnits
    },
    {
      id: 'storage' as SpaceTab,
      label: t('structure.tabs.storage', 'Αποθήκες'),
      icon: NAVIGATION_ENTITIES.storage.icon,
      iconColor: NAVIGATION_ENTITIES.storage.color,
      count: totalStorages
    },
    {
      id: 'parking' as SpaceTab,
      label: t('structure.tabs.parking', 'Στάθμευση'),
      icon: NAVIGATION_ENTITIES.parking.icon,
      iconColor: NAVIGATION_ENTITIES.parking.color,
      count: totalParkingSpots
    }
  ], [t, totalUnits, totalStorages, totalParkingSpots]);

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <article>
      {/* 🏢 ENTERPRISE: Building header */}
      <div
        className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer ${quick.card} ${colors.bg.primary} ${HOVER_BACKGROUND_EFFECTS.LIGHT} ${TRANSITION_PRESETS.STANDARD_COLORS}`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ?
          <ChevronDown size={20} className={colors.text.muted} /> :
          <ChevronRight size={20} className={colors.text.muted} />
        }
        <NAVIGATION_ENTITIES.building.icon className={cn(NAVIGATION_ENTITIES.building.color)} size={20} />
        <div className="flex-1">
          <div className={cn(typography.heading.sm, colors.text.foreground)}>{building.name}</div>
          <div className={cn(typography.body.sm, colors.text.muted)}>
            {totalUnits} {t('structure.units', 'μονάδες')} • {totalStorages} {t('structure.storages', 'αποθήκες')} • {totalParkingSpots} {t('structure.parkingSpots', 'θέσεις')}
          </div>
        </div>
        <div className={cn("text-right", typography.body.sm)}>
          <div className={cn(typography.heading.sm, colors.text.success)}>
            {totalUnits > 0 ? ((soldUnits / totalUnits) * 100).toFixed(1) : 0}% {t('structure.salesPercentage', 'πωλήσεις')}
          </div>
          <div className={colors.text.muted}>
            {soldArea.toFixed(1)} m² {t('structure.soldArea', 'πωλημένα')}
          </div>
        </div>
      </div>

      {/* 🏢 ENTERPRISE: Expandable content with tabs */}
      {isExpanded && (
        <div className={cn(spacing.margin.left.lg, spacing.margin.top.sm)}>
          {/* Tab triggers */}
          <nav className={cn("flex", spacing.gap.sm, spacing.margin.bottom.sm)} role="tablist">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={isActive}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveTab(tab.id);
                  }}
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors', typography.label.sm,
                    isActive
                      ? `${colors.bg.accent} ${colors.text.foreground}`
                      : `${colors.text.muted} hover:${colors.bg.muted}`
                  )}
                >
                  <Icon size={16} className={tab.iconColor} />
                  <span>{tab.label}</span>
                  <span className={cn(
                    'px-1.5 py-0.5 rounded', typography.body.xs,
                    isActive ? colors.bg.primary : colors.bg.muted
                  )}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Tab content */}
          <div className={spacing.spaceBetween.sm}>
            {activeTab === 'units' && (
              units.length === 0 ? (
                <p className={cn(typography.body.sm, colors.text.muted, spacing.padding.y.md, "text-center")}>
                  {t('structure.noUnits', 'Δεν υπάρχουν μονάδες')}
                </p>
              ) : (
                units.map(unit => <UnitNode key={unit.id} unit={unit} />)
              )
            )}

            {activeTab === 'storage' && (
              storages.length === 0 ? (
                <p className={cn(typography.body.sm, colors.text.muted, spacing.padding.y.md, "text-center")}>
                  {t('structure.noStorages', 'Δεν υπάρχουν αποθήκες')}
                </p>
              ) : (
                storages.map(storage => <StorageNode key={storage.id} storage={storage} />)
              )
            )}

            {activeTab === 'parking' && (
              parkingSpots.length === 0 ? (
                <p className={cn(typography.body.sm, colors.text.muted, spacing.padding.y.md, "text-center")}>
                  {t('structure.noParkingSpots', 'Δεν υπάρχουν θέσεις στάθμευσης')}
                </p>
              ) : (
                parkingSpots.map(spot => <ParkingNode key={spot.id} parking={spot} />)
              )
            )}
          </div>
        </div>
      )}
    </article>
  );
};
