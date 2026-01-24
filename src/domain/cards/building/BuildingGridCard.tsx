'use client';

/**
 * 🏢 ENTERPRISE BUILDING GRID CARD - Domain Component
 *
 * Domain-specific card for buildings in grid/tile views.
 * Extends GridCard with building-specific defaults and stats.
 *
 * @fileoverview Building domain card using centralized GridCard.
 * @enterprise Fortune 500 compliant - ZERO hardcoded values
 * @see GridCard for base component
 * @see BuildingListCard for list view equivalent
 * @see NAVIGATION_ENTITIES for entity config
 * @author Enterprise Architecture Team
 * @since 2026-01-24
 */

import React, { useMemo } from 'react';
// 🏢 ENTERPRISE: All icons from centralized NAVIGATION_ENTITIES
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';

// 🏢 DESIGN SYSTEM
import { GridCard } from '@/design-system';
import type { StatItem } from '@/design-system';

// 🏢 CENTRALIZED FORMATTERS
import { formatNumber } from '@/lib/intl-utils';

// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

// 🏢 DOMAIN TYPES
import type { Building } from '@/types/building/contracts';

// 🏢 BADGE VARIANT MAPPING
import type { GridCardBadgeVariant } from '@/design-system/components/GridCard/GridCard.types';

// =============================================================================
// 🏢 TYPES
// =============================================================================

export interface BuildingGridCardProps {
  /** Building data */
  building: Building;
  /** Whether card is selected */
  isSelected?: boolean;
  /** Whether item is favorite */
  isFavorite?: boolean;
  /** Click handler */
  onSelect?: () => void;
  /** Favorite toggle handler */
  onToggleFavorite?: () => void;
  /** Compact mode */
  compact?: boolean;
  /** Additional className */
  className?: string;
}

// =============================================================================
// 🏢 STATUS TO BADGE VARIANT MAPPING (Centralized)
// =============================================================================

const STATUS_BADGE_VARIANTS: Record<string, GridCardBadgeVariant> = {
  planning: 'warning',
  construction: 'info',
  completed: 'success',
  active: 'success',
};

// =============================================================================
// 🏢 COMPONENT
// =============================================================================

/**
 * 🏢 BuildingGridCard Component
 *
 * Domain-specific card for buildings in grid views.
 * Uses GridCard with building defaults from NAVIGATION_ENTITIES.
 *
 * @example
 * ```tsx
 * <BuildingGridCard
 *   building={building}
 *   isSelected={selectedId === building.id}
 *   onSelect={() => setSelectedId(building.id)}
 *   onToggleFavorite={() => toggleFavorite(building.id)}
 *   isFavorite={favorites.has(building.id)}
 * />
 * ```
 */
export function BuildingGridCard({
  building,
  isSelected = false,
  isFavorite,
  onSelect,
  onToggleFavorite,
  compact = false,
  className,
}: BuildingGridCardProps) {
  // ==========================================================================
  // 🏢 ENTERPRISE: i18n hook for translations
  // ==========================================================================
  const { t } = useTranslation('building');

  // ==========================================================================
  // 🏢 COMPUTED VALUES (Memoized)
  // ==========================================================================

  /** Build stats array from building data */
  const stats = useMemo<StatItem[]>(() => {
    const items: StatItem[] = [];

    // Total Area - 🏢 ENTERPRISE: Using centralized area icon/color + i18n
    if (building.totalArea) {
      items.push({
        icon: NAVIGATION_ENTITIES.area.icon,
        iconColor: NAVIGATION_ENTITIES.area.color,
        label: t('card.metrics.totalArea'),
        value: `${formatNumber(building.totalArea)} m²`,
      });
    }

    // Floors - 🏢 ENTERPRISE: Using i18n
    if (building.floors) {
      items.push({
        icon: NAVIGATION_ENTITIES.floor.icon,
        iconColor: NAVIGATION_ENTITIES.floor.color,
        label: t('card.metrics.floors'),
        value: String(building.floors),
      });
    }

    // Units - 🏢 ENTERPRISE: Using i18n
    if (building.units) {
      items.push({
        icon: NAVIGATION_ENTITIES.unit.icon,
        iconColor: NAVIGATION_ENTITIES.unit.color,
        label: t('card.metrics.units'),
        value: String(building.units),
      });
    }

    return items;
  }, [building.totalArea, building.floors, building.units, t]);

  /** Build badges from status - 🏢 ENTERPRISE: Using centralized i18n */
  const badges = useMemo(() => {
    const status = building.status || 'planning';
    const statusLabel = t(`status.${status}`, { defaultValue: status });
    const variant = STATUS_BADGE_VARIANTS[status] || 'default';

    return [{ label: statusLabel, variant }];
  }, [building.status, t]);

  /** Get category label for subtitle - 🏢 ENTERPRISE: Using centralized i18n */
  const categoryLabel = useMemo(() => {
    const category = building.category || 'mixed';
    return t(`category.${category}`, { defaultValue: category });
  }, [building.category, t]);

  // ==========================================================================
  // 🏢 RENDER
  // ==========================================================================

  return (
    <GridCard
      entityType="building"
      title={building.name || building.id}
      subtitle={categoryLabel}
      badges={badges}
      stats={stats}
      isSelected={isSelected}
      onClick={onSelect}
      isFavorite={isFavorite}
      onToggleFavorite={onToggleFavorite}
      compact={compact}
      className={className}
      aria-label={t('accessibility.buildingCard', { name: building.name || building.id })}
    />
  );
}

BuildingGridCard.displayName = 'BuildingGridCard';

export default BuildingGridCard;
