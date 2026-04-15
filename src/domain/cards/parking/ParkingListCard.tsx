// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
'use client';

/**
 * 🅿️ ENTERPRISE PARKING LIST CARD - Domain Component
 *
 * Domain-specific card for parking spots in list views.
 * Extends ListCard with parking-specific defaults and stats.
 *
 * @fileoverview Parking domain card using centralized ListCard.
 * @enterprise Fortune 500 compliant - ZERO hardcoded values
 * @see ListCard for base component
 * @see NAVIGATION_ENTITIES for entity config
 * @author Enterprise Architecture Team
 * @since 2026-01-08
 */

import React, { useMemo } from 'react';
// 🏢 ENTERPRISE: All icons from centralized NAVIGATION_ENTITIES
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';

// 🏢 DESIGN SYSTEM
import { ListCard } from '@/design-system';
import type { StatItem } from '@/design-system';

// 🏢 CENTRALIZED FORMATTERS
import { formatCurrency, formatFloorString } from '@/lib/intl-utils';
import { buildCardSubtitle } from '@/domain/cards/shared/card-subtitle';

// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

// 🏢 DOMAIN TYPES
// NOTE: Υπάρχουν 2 ParkingSpot types - @/types/parking & @/hooks/useFirestoreParkingSpots
// Αυτό το component υποστηρίζει και τα δύο με adapter pattern
// 🌐 i18n: Type/status labels now use t() directly instead of imported constants

/**
 * 🏢 ADAPTER TYPE - Υποστηρίζει και τα δύο ParkingSpot schemas
 * TODO: Κεντρικοποίηση σε ένα ParkingSpot type
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

// 🏢 BADGE VARIANT MAPPING
import type { ListCardBadgeVariant } from '@/design-system/components/ListCard/ListCard.types';
import '@/lib/design-system';

// =============================================================================
// 🏢 TYPES
// =============================================================================

export interface ParkingListCardProps {
  /** Parking spot data - supports both @/types/parking and @/hooks schemas */
  parking: ParkingSpotAdapter;
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

const STATUS_BADGE_VARIANTS: Record<string, ListCardBadgeVariant> = {
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
 * 🅿️ ParkingListCard Component
 *
 * Domain-specific card for parking spots.
 * Uses ListCard with parking defaults from NAVIGATION_ENTITIES.
 *
 * @example
 * ```tsx
 * <ParkingListCard
 *   parking={parkingSpot}
 *   isSelected={selectedId === parkingSpot.id}
 *   onSelect={() => setSelectedId(parkingSpot.id)}
 *   onToggleFavorite={() => toggleFavorite(parkingSpot.id)}
 *   isFavorite={favorites.has(parkingSpot.id)}
 * />
 * ```
 */
export function ParkingListCard({
  parking,
  isSelected = false,
  isFavorite,
  onSelect,
  onToggleFavorite,
  compact = false,
  className,
}: ParkingListCardProps) {
  const { t } = useTranslation('parking');

  // ==========================================================================
  // 🏢 COMPUTED VALUES (Memoized)
  // ==========================================================================

  /** Build stats array from parking data */
  const stats = useMemo<StatItem[]>(() => {
    const items: StatItem[] = [];

    // Level/Floor - 🏢 ENTERPRISE: Using centralized floor icon/color & formatFloorString
    const levelValue = parking.level || parking.floor;
    if (levelValue) {
      items.push({
        icon: NAVIGATION_ENTITIES.floor.icon,
        iconColor: NAVIGATION_ENTITIES.floor.color,
        label: t('card.stats.level'),
        value: formatFloorString(levelValue),
      });
    }

    // Area - 🏢 ENTERPRISE: Using centralized area icon/color
    if (parking.area) {
      items.push({
        icon: NAVIGATION_ENTITIES.area.icon,
        iconColor: NAVIGATION_ENTITIES.area.color,
        label: t('card.stats.area'),
        value: `${parking.area} m²`,
      });
    }

    // Price - 🏢 ENTERPRISE: Using centralized price icon/color
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
    // 🏢 ENTERPRISE: Use t() to translate status labels
    const statusLabel = t(`status.${status}`, { defaultValue: status });
    const variant = STATUS_BADGE_VARIANTS[status] || 'default';

    return [{ label: statusLabel, variant }];
  }, [parking.status, t]);

  /** Get type label for subtitle */
  const typeLabel = useMemo(() => {
    const type = parking.type || 'standard';
    // 🏢 ENTERPRISE: Use t() to translate type labels
    return t(`types.${type}`, { defaultValue: type });
  }, [parking.type, t]);

  // ==========================================================================
  // 🏢 RENDER
  // ==========================================================================

  // ADR-233: number = human title (e.g. "Θέση 1"), code = system identifier in subtitle
  const title = parking.number || parking.code || parking.id;

  return (
    <ListCard
      entityType="parking"
      title={title}
      subtitle={buildCardSubtitle(typeLabel, parking.code)}
      badges={badges}
      stats={stats}
      isSelected={isSelected}
      onClick={onSelect}
      isFavorite={isFavorite}
      onToggleFavorite={onToggleFavorite}
      compact={compact}
      className={className}
      aria-label={t('card.ariaLabel', { name: title })}
    />
  );
}

ParkingListCard.displayName = 'ParkingListCard';

export default ParkingListCard;
