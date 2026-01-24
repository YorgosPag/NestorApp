// 🌐 i18n: All labels use i18n keys
'use client';

/**
 * 🅿️ ENTERPRISE PARKING GRID CARD - Domain Component
 *
 * Domain-specific card for parking spots in grid/tile views.
 * Extends GridCard with parking-specific defaults and stats.
 *
 * @fileoverview Parking domain card using centralized GridCard.
 * @enterprise Fortune 500 compliant - ZERO hardcoded values
 * @see GridCard for base component
 * @see ParkingListCard for list view equivalent
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
import { formatCurrency, formatFloorString } from '@/lib/intl-utils';

// 🏢 ENTERPRISE: i18n support (using custom hook with lazy loading)
import { useTranslation } from '@/i18n/hooks/useTranslation';

// 🏢 DOMAIN TYPES
// NOTE: Using adapter pattern to support both ParkingSpot schemas
// i18n keys are used directly instead of importing from @/types/parking

// 🏢 BADGE VARIANT MAPPING
import type { GridCardBadgeVariant } from '@/design-system/components/GridCard/GridCard.types';

// =============================================================================
// 🏢 ADAPTER TYPE - Supports both ParkingSpot schemas
// =============================================================================

/**
 * 🏢 ADAPTER TYPE - Supports both @/types/parking and @/hooks schemas
 * Shared with ParkingListCard for consistency
 */
interface ParkingSpotAdapter {
  id: string;
  // Title: code (types/parking) OR number (hooks)
  code?: string;
  number?: string;
  // Level: level (types/parking) OR floor (hooks)
  level?: string;
  floor?: string;
  // Type
  type?: string;
  // Status
  status?: string;
  // Area
  area?: number;
  // Price
  price?: number;
}

// =============================================================================
// 🏢 TYPES
// =============================================================================

export interface ParkingGridCardProps {
  /** Parking spot data - supports both @/types/parking and @/hooks schemas */
  parking: ParkingSpotAdapter;
  /** Whether card is selected */
  isSelected?: boolean;
  /** Whether item is favorite */
  isFavorite?: boolean;
  /** Click handler - supports shift-click for multi-select */
  onSelect?: (isShiftClick?: boolean) => void;
  /** Favorite toggle handler */
  onToggleFavorite?: () => void;
  /** Compact mode */
  compact?: boolean;
  /** Additional className */
  className?: string;
}

// =============================================================================
// 🏢 STATUS TO BADGE VARIANT MAPPING (Shared with ParkingListCard)
// =============================================================================

const STATUS_BADGE_VARIANTS: Record<string, GridCardBadgeVariant> = {
  available: 'success',
  occupied: 'info',
  reserved: 'warning',
  sold: 'secondary',
  maintenance: 'destructive',
};

// =============================================================================
// 🏢 COMPONENT
// =============================================================================

/**
 * 🅿️ ParkingGridCard Component
 *
 * Domain-specific card for parking spots in grid views.
 * Uses GridCard with parking defaults from NAVIGATION_ENTITIES.
 *
 * @example
 * ```tsx
 * <ParkingGridCard
 *   parking={parkingSpot}
 *   isSelected={selectedId === parkingSpot.id}
 *   onSelect={() => setSelectedId(parkingSpot.id)}
 *   onToggleFavorite={() => toggleFavorite(parkingSpot.id)}
 *   isFavorite={favorites.has(parkingSpot.id)}
 * />
 * ```
 */
export function ParkingGridCard({
  parking,
  isSelected = false,
  isFavorite,
  onSelect,
  onToggleFavorite,
  compact = false,
  className,
}: ParkingGridCardProps) {
  const { t } = useTranslation('parking');

  // ==========================================================================
  // 🏢 COMPUTED VALUES (Memoized)
  // ==========================================================================

  /** Build stats array for grid view - vertical layout optimized */
  const stats = useMemo<StatItem[]>(() => {
    const items: StatItem[] = [];

    // Level/Floor with icon - 🏢 ENTERPRISE: Using formatFloorString for proper i18n
    const levelValue = parking.level || parking.floor;
    if (levelValue) {
      items.push({
        icon: NAVIGATION_ENTITIES.floor.icon,
        iconColor: NAVIGATION_ENTITIES.floor.color,
        label: t('card.stats.level'),
        value: formatFloorString(levelValue),
      });
    }

    // Area with icon
    if (parking.area) {
      items.push({
        icon: NAVIGATION_ENTITIES.area.icon,
        iconColor: NAVIGATION_ENTITIES.area.color,
        label: t('card.stats.area'),
        value: `${parking.area} m²`,
      });
    }

    // Price with icon (optional - may not be shown in grid view)
    if (parking.price && parking.price > 0) {
      items.push({
        icon: NAVIGATION_ENTITIES.price.icon,
        iconColor: NAVIGATION_ENTITIES.price.color,
        label: t('card.stats.price'),
        value: formatCurrency(parking.price, 'EUR', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }),
        valueColor: NAVIGATION_ENTITIES.price.color,
      });
    }

    return items;
  }, [parking.level, parking.floor, parking.area, parking.price, t]);

  /** Build badges from status */
  const badges = useMemo(() => {
    const status = parking.status || 'available';
    // 🏢 ENTERPRISE: Use i18n for status labels
    const statusLabel = t(`general.statuses.${status}`, { defaultValue: status });
    const variant = STATUS_BADGE_VARIANTS[status] || 'default';

    return [{ label: statusLabel, variant }];
  }, [parking.status, t]);

  /** Get type label for subtitle */
  const typeLabel = useMemo(() => {
    const type = parking.type || 'standard';
    // 🏢 ENTERPRISE: Use i18n for type labels
    return t(`general.types.${type}`, { defaultValue: type });
  }, [parking.type, t]);

  // ==========================================================================
  // 🏢 HANDLERS
  // ==========================================================================

  const handleClick = () => {
    onSelect?.(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect?.(event.shiftKey || event.metaKey);
    }
  };

  // ==========================================================================
  // 🏢 RENDER
  // ==========================================================================

  // Title supports both schemas: code (types/parking) OR number (hooks)
  const title = parking.code || parking.number || parking.id;

  return (
    <GridCard
      entityType="parking"
      title={title}
      subtitle={typeLabel}
      badges={badges}
      stats={stats}
      isSelected={isSelected}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      isFavorite={isFavorite}
      onToggleFavorite={onToggleFavorite}
      compact={compact}
      className={className}
      aria-label={t('card.ariaLabel', { name: title })}
    />
  );
}

ParkingGridCard.displayName = 'ParkingGridCard';

export default ParkingGridCard;
