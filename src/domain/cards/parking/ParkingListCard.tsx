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
import { MapPin, Ruler, Euro } from 'lucide-react';

// 🏢 DESIGN SYSTEM
import { ListCard } from '@/design-system';
import type { StatItem } from '@/design-system';

// 🏢 CENTRALIZED FORMATTERS
import { formatCurrency } from '@/lib/intl-utils';

// 🏢 DOMAIN TYPES
// NOTE: Υπάρχουν 2 ParkingSpot types - @/types/parking & @/hooks/useFirestoreParkingSpots
// Αυτό το component υποστηρίζει και τα δύο με adapter pattern
import { PARKING_TYPE_LABELS, PARKING_STATUS_LABELS } from '@/types/parking';

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
  // ==========================================================================
  // 🏢 COMPUTED VALUES (Memoized)
  // ==========================================================================

  /** Build stats array from parking data */
  const stats = useMemo<StatItem[]>(() => {
    const items: StatItem[] = [];

    // Level/Floor - supports both schemas
    const levelValue = parking.level || parking.floor;
    if (levelValue) {
      items.push({
        icon: MapPin,
        label: 'Επίπεδο',
        value: levelValue,
      });
    }

    // Area
    if (parking.area) {
      items.push({
        icon: Ruler,
        label: 'Εμβαδόν',
        value: `${parking.area} m²`,
      });
    }

    // Price
    if (parking.price && parking.price > 0) {
      items.push({
        icon: Euro,
        label: 'Τιμή',
        value: formatCurrency(parking.price, 'EUR', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }),
      });
    }

    return items;
  }, [parking.level, parking.floor, parking.area, parking.price]);

  /** Build badges from status */
  const badges = useMemo(() => {
    const status = parking.status || 'available';
    const statusLabel = PARKING_STATUS_LABELS[status as keyof typeof PARKING_STATUS_LABELS] || status;
    const variant = STATUS_BADGE_VARIANTS[status] || 'default';

    return [{ label: statusLabel, variant }];
  }, [parking.status]);

  /** Get type label for subtitle */
  const typeLabel = useMemo(() => {
    const type = parking.type || 'standard';
    return PARKING_TYPE_LABELS[type as keyof typeof PARKING_TYPE_LABELS] || type;
  }, [parking.type]);

  // ==========================================================================
  // 🏢 RENDER
  // ==========================================================================

  // Title supports both schemas: code (types/parking) OR number (hooks)
  const title = parking.code || parking.number || parking.id;

  return (
    <ListCard
      entityType="parking"
      title={title}
      subtitle={typeLabel}
      badges={badges}
      stats={stats}
      isSelected={isSelected}
      onClick={onSelect}
      isFavorite={isFavorite}
      onToggleFavorite={onToggleFavorite}
      compact={compact}
      className={className}
      aria-label={`Θέση στάθμευσης ${title}`}
    />
  );
}

ParkingListCard.displayName = 'ParkingListCard';

export default ParkingListCard;
