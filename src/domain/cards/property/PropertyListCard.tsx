// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
'use client';

/**
 * 🏠 ENTERPRISE PROPERTY LIST CARD - Domain Component
 *
 * Domain-specific card for properties in list views.
 * Extends ListCard with property-specific defaults and stats.
 *
 * @fileoverview Property domain card using centralized ListCard.
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
import { formatCurrency, formatFloorLabel } from '@/lib/intl-utils';

// 🏢 DOMAIN TYPES
import type { Property } from '@/types/property-viewer';

// 🏢 BADGE VARIANT MAPPING
import type { ListCardBadgeVariant } from '@/design-system/components/ListCard/ListCard.types';

// 🏢 ENTERPRISE: i18n support
import { useTranslation } from 'react-i18next';

// =============================================================================
// 🏢 TYPES
// =============================================================================

export interface PropertyListCardProps {
  /** Property data */
  property: Property;
  /** Whether card is selected */
  isSelected?: boolean;
  /** Whether item is favorite */
  isFavorite?: boolean;
  /** Click handler */
  onSelect?: (isShiftClick?: boolean) => void;
  /** Favorite toggle handler */
  onToggleFavorite?: () => void;
  /** View floor plan handler (optional) */
  onViewFloorPlan?: (id: string) => void;
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
  reserved: 'destructive',
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
 * 🏠 PropertyListCard Component
 *
 * Domain-specific card for properties.
 * Uses ListCard with property defaults from NAVIGATION_ENTITIES.
 *
 * @example
 * ```tsx
 * <PropertyListCard
 *   property={property}
 *   isSelected={selectedId === property.id}
 *   onSelect={(isShift) => handleSelect(property.id, isShift)}
 *   onToggleFavorite={() => toggleFavorite(property.id)}
 *   isFavorite={favorites.has(property.id)}
 * />
 * ```
 */
export function PropertyListCard({
  property,
  isSelected = false,
  isFavorite,
  onSelect,
  onToggleFavorite,
  onViewFloorPlan,
  compact = false,
  className,
}: PropertyListCardProps) {
  const { t } = useTranslation('properties');

  // ==========================================================================
  // 🏢 COMPUTED VALUES (Memoized)
  // ==========================================================================

  /** Build stats array from property data */
  const stats = useMemo<StatItem[]>(() => {
    const items: StatItem[] = [];

    // Building & Floor
    if (property.building) {
      items.push({
        icon: NAVIGATION_ENTITIES.building.icon,
        iconColor: NAVIGATION_ENTITIES.building.color,
        label: t('card.stats.building'),
        value: property.building,
      });
    }

    // Floor - 🏢 ENTERPRISE: Using centralized floor color
    if (property.floor !== undefined) {
      items.push({
        icon: NAVIGATION_ENTITIES.floor.icon,
        iconColor: NAVIGATION_ENTITIES.floor.color,
        label: t('card.stats.floor'),
        value: formatFloorLabel(property.floor),
      });
    }

    // Area - 🏢 ENTERPRISE: Using centralized area icon/color
    if (property.area) {
      items.push({
        icon: NAVIGATION_ENTITIES.area.icon,
        iconColor: NAVIGATION_ENTITIES.area.color,
        label: t('card.stats.area'),
        value: `${property.area} m²`,
      });
    }

    // Price - 🏢 ENTERPRISE: Using centralized price icon/color
    if (property.price && property.price > 0) {
      items.push({
        icon: NAVIGATION_ENTITIES.price.icon,
        iconColor: NAVIGATION_ENTITIES.price.color,
        label: t('card.stats.price'),
        value: formatCurrency(property.price, 'EUR', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }),
        valueColor: NAVIGATION_ENTITIES.price.color,
      });
    }

    return items;
  }, [property.building, property.floor, property.area, property.price, t]);

  /** Build badges from status */
  const badges = useMemo(() => {
    const status = property.status || 'for-sale';
    const labelKey = STATUS_LABEL_KEYS[status] || 'status.unknown';
    const statusLabel = t(labelKey);
    const variant = STATUS_BADGE_VARIANTS[status] || 'default';

    return [{ label: statusLabel, variant }];
  }, [property.status, t]);

  /** Get subtitle - type and project */
  const subtitle = useMemo(() => {
    const parts: string[] = [];
    if (property.type) parts.push(property.type);
    if (property.project) parts.push(property.project);
    return parts.join(' • ') || undefined;
  }, [property.type, property.project]);

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
      title={property.name || property.id}
      subtitle={subtitle}
      badges={badges}
      stats={stats}
      isSelected={isSelected}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      isFavorite={isFavorite}
      onToggleFavorite={onToggleFavorite}
      compact={compact}
      className={className}
      aria-label={t('card.ariaLabel', { name: property.name || property.id })}
    />
  );
}

PropertyListCard.displayName = 'PropertyListCard';

export default PropertyListCard;
