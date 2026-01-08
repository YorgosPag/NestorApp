'use client';

/**
 * 🏠 ENTERPRISE UNIT LIST CARD - Domain Component
 *
 * Domain-specific card for units/properties in list views.
 * Extends ListCard with unit-specific defaults and stats.
 *
 * @fileoverview Unit domain card using centralized ListCard.
 * @enterprise Fortune 500 compliant - ZERO hardcoded values
 * @see ListCard for base component
 * @see NAVIGATION_ENTITIES for entity config
 * @author Enterprise Architecture Team
 * @since 2026-01-08
 */

import React, { useMemo } from 'react';
import { Ruler, Euro } from 'lucide-react';

// 🏢 DESIGN SYSTEM
import { ListCard } from '@/design-system';
import type { StatItem } from '@/design-system';

// 🏢 CENTRALIZED FORMATTERS
import { formatCurrency, formatNumber } from '@/lib/intl-utils';

// 🏢 DOMAIN TYPES
import type { Property } from '@/types/property-viewer';

// 🏢 BADGE VARIANT MAPPING
import type { ListCardBadgeVariant } from '@/design-system/components/ListCard/ListCard.types';

// =============================================================================
// 🏢 TYPES
// =============================================================================

export interface UnitListCardProps {
  /** Unit/Property data */
  unit: Property;
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
// 🏢 STATUS TO BADGE VARIANT MAPPING (Centralized)
// =============================================================================

const STATUS_BADGE_VARIANTS: Record<string, ListCardBadgeVariant> = {
  'for-sale': 'info',
  'for-rent': 'warning',
  sold: 'success',
  rented: 'secondary',
  reserved: 'warning',
};

// =============================================================================
// 🏢 STATUS LABELS (Greek)
// =============================================================================

const STATUS_LABELS: Record<string, string> = {
  'for-sale': 'Προς Πώληση',
  'for-rent': 'Προς Ενοικίαση',
  sold: 'Πουλημένο',
  rented: 'Ενοικιασμένο',
  reserved: 'Κρατημένο',
};

// =============================================================================
// 🏢 COMPONENT
// =============================================================================

/**
 * 🏠 UnitListCard Component
 *
 * Domain-specific card for units/properties.
 * Uses ListCard with unit defaults from NAVIGATION_ENTITIES.
 *
 * @example
 * ```tsx
 * <UnitListCard
 *   unit={property}
 *   isSelected={selectedId === property.id}
 *   onSelect={() => setSelectedId(property.id)}
 *   onToggleFavorite={() => toggleFavorite(property.id)}
 *   isFavorite={favorites.has(property.id)}
 * />
 * ```
 */
export function UnitListCard({
  unit,
  isSelected = false,
  isFavorite,
  onSelect,
  onToggleFavorite,
  compact = false,
  className,
}: UnitListCardProps) {
  // ==========================================================================
  // 🏢 COMPUTED VALUES (Memoized)
  // ==========================================================================

  /** Build stats array from unit data */
  const stats = useMemo<StatItem[]>(() => {
    const items: StatItem[] = [];

    // Area
    if (unit.area) {
      items.push({
        icon: Ruler,
        label: 'Επιφάνεια',
        value: `${formatNumber(unit.area)} m²`,
      });
    }

    // Price
    if (unit.price && unit.price > 0) {
      items.push({
        icon: Euro,
        label: 'Τιμή',
        value: formatCurrency(unit.price, 'EUR', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }),
        valueColor: 'text-green-600 dark:text-green-400',
      });
    }

    return items;
  }, [unit.area, unit.price]);

  /** Build badges from status */
  const badges = useMemo(() => {
    const status = unit.status || 'for-sale';
    const statusLabel = STATUS_LABELS[status] || status;
    const variant = STATUS_BADGE_VARIANTS[status] || 'default';

    return [{ label: statusLabel, variant }];
  }, [unit.status]);

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

  return (
    <ListCard
      entityType="unit"
      title={unit.name || unit.id}
      subtitle={unit.type}
      badges={badges}
      stats={stats}
      isSelected={isSelected}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      isFavorite={isFavorite}
      onToggleFavorite={onToggleFavorite}
      compact={compact}
      className={className}
      aria-label={`Μονάδα ${unit.name || unit.id}`}
    />
  );
}

UnitListCard.displayName = 'UnitListCard';

export default UnitListCard;
