// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
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
// 🏢 ENTERPRISE: All icons from centralized NAVIGATION_ENTITIES
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';

// 🏢 DESIGN SYSTEM
import { ListCard } from '@/design-system';
import type { StatItem } from '@/design-system';

// 🏢 CENTRALIZED FORMATTERS
import { formatCurrency, formatNumber } from '@/lib/intl-utils';

// 🏢 DOMAIN TYPES
import type { Property } from '@/types/property-viewer';

// 🏢 BADGE VARIANT MAPPING
import type { ListCardBadgeVariant } from '@/design-system/components/ListCard/ListCard.types';

// 🏢 ENTERPRISE: i18n support
import { useTranslation } from 'react-i18next';

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
// 🏢 STATUS LABELS (i18n keys)
// =============================================================================

const STATUS_LABEL_KEYS: Record<string, string> = {
  'for-sale': 'status.forSale',
  'for-rent': 'status.forRent',
  sold: 'status.sold',
  rented: 'status.rented',
  reserved: 'status.reserved',
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
  const { t } = useTranslation('units');

  // ==========================================================================
  // 🏢 COMPUTED VALUES (Memoized)
  // ==========================================================================

  /** Build stats array from unit data */
  const stats = useMemo<StatItem[]>(() => {
    const items: StatItem[] = [];

    // Area - 🏢 ENTERPRISE: Using centralized area icon/color
    if (unit.area) {
      items.push({
        icon: NAVIGATION_ENTITIES.area.icon,
        iconColor: NAVIGATION_ENTITIES.area.color,
        label: t('card.stats.area'),
        value: `${formatNumber(unit.area)} m²`,
      });
    }

    // Price - 🏢 ENTERPRISE: Using centralized price icon/color
    if (unit.price && unit.price > 0) {
      items.push({
        icon: NAVIGATION_ENTITIES.price.icon,
        iconColor: NAVIGATION_ENTITIES.price.color,
        label: t('card.stats.price'),
        value: formatCurrency(unit.price, 'EUR', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }),
        valueColor: NAVIGATION_ENTITIES.price.color,
      });
    }

    return items;
  }, [unit.area, unit.price, t]);

  /** Build badges from status */
  const badges = useMemo(() => {
    const status = unit.status || 'for-sale';
    const labelKey = STATUS_LABEL_KEYS[status] || 'status.unknown';
    const statusLabel = t(labelKey);
    const variant = STATUS_BADGE_VARIANTS[status] || 'default';

    return [{ label: statusLabel, variant }];
  }, [unit.status, t]);

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
      aria-label={t('card.ariaLabel', { name: unit.name || unit.id })}
    />
  );
}

UnitListCard.displayName = 'UnitListCard';

export default UnitListCard;
