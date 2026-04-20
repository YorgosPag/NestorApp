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
import { buildCardSubtitle } from '@/domain/cards/shared/card-subtitle';

// 🏢 DOMAIN TYPES
import type { Property } from '@/types/property-viewer';

// 🏢 BADGE VARIANT MAPPING
import type { ListCardBadgeVariant } from '@/design-system/components/ListCard/ListCard.types';

// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { ENTITY_TYPES } from '@/config/domain-constants';
import '@/lib/design-system';

// =============================================================================
// 🏢 TYPES
// =============================================================================

export interface PropertyListCardProps {
  /** Property data */
  property: Property;
  /** Whether card is selected */
  isSelected?: boolean;
  /** External hover highlight — bidirectional sync from canvas (SPEC-237C) */
  isHovered?: boolean;
  /** Whether item is favorite */
  isFavorite?: boolean;
  /** Click handler */
  onSelect?: (isShiftClick?: boolean) => void;
  /** Mouse enter handler — bidirectional hover sync (SPEC-237C) */
  onMouseEnter?: () => void;
  /** Mouse leave handler — bidirectional hover sync (SPEC-237C) */
  onMouseLeave?: () => void;
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

// 🎯 PR1.2: Remove sales statuses (for-sale/sold/reserved) - Units use operational status
const STATUS_BADGE_VARIANTS: Record<string, ListCardBadgeVariant> = {
  'for-rent': 'warning',
  rented: 'secondary',
  ready: 'success', // Operational status
  'under-construction': 'info',
  maintenance: 'destructive',
  draft: 'default',
};

// =============================================================================
// 🏢 STATUS LABELS (i18n keys)
// =============================================================================

// 🎯 PR1.2: Remove sales statuses - use operational status i18n keys
const STATUS_LABEL_KEYS: Record<string, string> = {
  'for-rent': 'status.forRent',
  rented: 'status.rented',
  ready: 'operationalStatus.ready',
  'under-construction': 'operationalStatus.underConstruction',
  maintenance: 'operationalStatus.maintenance',
  draft: 'operationalStatus.draft',
};

const COMMERCIAL_STATUS_BADGE_VARIANTS: Record<string, ListCardBadgeVariant> = {
  'for-sale': 'info',
  'for-rent': 'warning',
  'for-sale-and-rent': 'secondary',
  'unavailable': 'default',
};

const COMMERCIAL_STATUS_LABEL_KEYS: Record<string, string> = {
  'for-sale': 'commercialStatus.for-sale',
  'for-rent': 'commercialStatus.for-rent',
  'for-sale-and-rent': 'commercialStatus.for-sale-and-rent',
  'unavailable': 'commercialStatus.unavailable',
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
  isHovered = false,
  isFavorite,
  onSelect,
  onMouseEnter,
  onMouseLeave,
  onToggleFavorite,
  onViewFloorPlan,
  compact = false,
  className,
}: PropertyListCardProps) {
  const { t } = useTranslation(['properties', 'properties-viewer', 'properties-enums', 'properties-detail']);

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
    const _displayArea = property.areas?.gross || property.area;
    if (_displayArea) {
      items.push({
        icon: NAVIGATION_ENTITIES.area.icon,
        iconColor: NAVIGATION_ENTITIES.area.color,
        label: t('card.stats.area'),
        value: `${_displayArea} m²`,
      });
    }

    // Price — context-aware per commercialStatus (ADR-197 + rentPrice extension)
    const cs = property.commercialStatus;
    const salePrice = property.commercial?.askingPrice ?? property.price;
    const rentPrice = property.commercial?.rentPrice;

    if (cs === 'for-rent') {
      if (rentPrice && rentPrice > 0) {
        items.push({
          icon: NAVIGATION_ENTITIES.price.icon,
          iconColor: NAVIGATION_ENTITIES.price.color,
          label: t('card.stats.rent'),
          value: `${formatCurrency(rentPrice, 'EUR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}/μήνα`,
          valueColor: NAVIGATION_ENTITIES.price.color,
        });
      }
    } else if (cs === 'for-sale-and-rent') {
      if (salePrice && salePrice > 0) {
        items.push({
          icon: NAVIGATION_ENTITIES.price.icon,
          iconColor: NAVIGATION_ENTITIES.price.color,
          label: t('card.stats.sale'),
          value: formatCurrency(salePrice, 'EUR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
          valueColor: NAVIGATION_ENTITIES.price.color,
        });
      }
      if (rentPrice && rentPrice > 0) {
        items.push({
          icon: NAVIGATION_ENTITIES.price.icon,
          iconColor: NAVIGATION_ENTITIES.price.color,
          label: t('card.stats.rent'),
          value: `${formatCurrency(rentPrice, 'EUR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}/μήνα`,
          valueColor: NAVIGATION_ENTITIES.price.color,
        });
      }
    } else {
      if (salePrice && salePrice > 0) {
        items.push({
          icon: NAVIGATION_ENTITIES.price.icon,
          iconColor: NAVIGATION_ENTITIES.price.color,
          label: t('card.stats.price'),
          value: formatCurrency(salePrice, 'EUR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
          valueColor: NAVIGATION_ENTITIES.price.color,
        });
      }
    }

    return items;
  }, [property.building, property.floor, property.area, property.price, property.commercial?.askingPrice, property.commercial?.rentPrice, property.commercialStatus, t]);

  /** Build badges from operational status + commercial status */
  const badges = useMemo(() => {
    const status = property.operationalStatus || property.status || 'ready';
    const labelKey = STATUS_LABEL_KEYS[status] || 'operationalStatus.ready';
    const variant = STATUS_BADGE_VARIANTS[status] || 'success';
    const result: { label: string; variant: ListCardBadgeVariant }[] = [
      { label: t(labelKey), variant },
    ];

    const cs = property.commercialStatus;
    if (cs && COMMERCIAL_STATUS_LABEL_KEYS[cs]) {
      result.push({
        label: t(COMMERCIAL_STATUS_LABEL_KEYS[cs], { ns: 'properties-enums' }),
        variant: COMMERCIAL_STATUS_BADGE_VARIANTS[cs] ?? 'default',
      });
    }

    return result;
  }, [property.operationalStatus, property.status, property.commercialStatus, t]);

  /** Get subtitle - type, code, and project */
  const subtitle = useMemo(() => {
    const parts: string[] = [];
    if (property.type) {
      const typeLabel = t(`types.${property.type}`, { ns: 'properties', defaultValue: property.type });
      parts.push(buildCardSubtitle(typeLabel, property.code));
    }
    if (property.project) parts.push(property.project);
    return parts.join(' • ') || undefined;
  }, [property.type, property.code, property.project]);

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
      entityType={ENTITY_TYPES.PROPERTY}
      title={property.name || property.id}
      subtitle={subtitle}
      badges={badges}
      stats={stats}
      isSelected={isSelected}
      isHovered={isHovered}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
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
