// 🌐 i18n: All labels use i18n keys
'use client';

/**
 * 🏠 ENTERPRISE PROPERTY GRID CARD - Domain Component
 *
 * Domain-specific card for properties in grid/tile views.
 * Extends GridCard with property-specific defaults and stats.
 *
 * @fileoverview Property domain card using centralized GridCard.
 * @enterprise Fortune 500 compliant - ZERO hardcoded values
 * @see GridCard for base component
 * @see PropertyListCard for list view equivalent
 * @see NAVIGATION_ENTITIES for entity config
 * @author Enterprise Architecture Team
 * @since 2026-01-24
 */

import React, { useMemo } from 'react';
// 🏢 ENTERPRISE: All icons from centralized NAVIGATION_ENTITIES
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
// 🏢 PHASE 1 & 4: Layout and condition icons (not in NAVIGATION_ENTITIES yet)
import { Bed, Bath, Wrench } from 'lucide-react';

// 🏢 DESIGN SYSTEM
import { GridCard } from '@/design-system';
import type { StatItem } from '@/design-system';

// 🏢 CENTRALIZED FORMATTERS
import { formatNumber, formatFloorLabel } from '@/lib/intl-utils';

// 🏢 DOMAIN TYPES
import type { Property } from '@/types/property-viewer';

// 🏢 BADGE VARIANT MAPPING
import type { GridCardBadgeVariant } from '@/design-system/components/GridCard/GridCard.types';

// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { ENTITY_TYPES } from '@/config/domain-constants';
import '@/lib/design-system';

// =============================================================================
// 🏢 TYPES
// =============================================================================

export interface PropertyGridCardProps {
  /** Property data */
  property: Property;
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
// 🏢 OPERATIONAL STATUS TO BADGE VARIANT MAPPING (Physical Truth)
// =============================================================================

/**
 * ✅ DOMAIN SEPARATION: Operational status mapping (construction/readiness)
 * Shared with PropertyListCard for consistency
 */
const OPERATIONAL_STATUS_VARIANTS: Record<string, GridCardBadgeVariant> = {
  'ready': 'success',              // Έτοιμο
  'under-construction': 'warning', // υπό ολοκλήρωση
  'inspection': 'info',            // σε επιθεώρηση
  'maintenance': 'secondary',      // υπό συντήρηση
  'draft': 'default',              // πρόχειρο
};

// =============================================================================
// 🏢 OPERATIONAL STATUS LABELS (i18n keys)
// =============================================================================

const OPERATIONAL_STATUS_LABEL_KEYS: Record<string, string> = {
  'ready': 'operationalStatus.ready',
  'under-construction': 'operationalStatus.underConstruction',
  'inspection': 'operationalStatus.inspection',
  'maintenance': 'operationalStatus.maintenance',
  'draft': 'operationalStatus.draft',
};

// =============================================================================
// 🏢 COMPONENT
// =============================================================================

/**
 * 🏠 PropertyGridCard Component
 *
 * Domain-specific card for properties in grid views.
 * Uses GridCard with property defaults from NAVIGATION_ENTITIES.
 *
 * @example
 * ```tsx
 * <PropertyGridCard
 *   property={property}
 *   isSelected={selectedId === property.id}
 *   onSelect={() => setSelectedId(property.id)}
 *   onToggleFavorite={() => toggleFavorite(property.id)}
 *   isFavorite={favorites.has(property.id)}
 * />
 * ```
 */
export function PropertyGridCard({
  property,
  isSelected = false,
  isFavorite,
  onSelect,
  onToggleFavorite,
  compact = false,
  className,
}: PropertyGridCardProps) {
  const { t } = useTranslation(['properties', 'properties-detail', 'properties-enums', 'properties-viewer']);

  // ==========================================================================
  // 🏢 COMPUTED VALUES (Memoized)
  // ==========================================================================

  /** Build stats array for grid view - vertical layout optimized */
  const stats = useMemo<StatItem[]>(() => {
    const items: StatItem[] = [];

    // 🏢 ENTERPRISE: Use new areas schema with legacy fallback (Fix 85 vs 5.2 inconsistency)
    const displayArea = property.areas?.gross ?? property.area;

    // Building with icon
    if (property.building) {
      items.push({
        icon: NAVIGATION_ENTITIES.building.icon,
        iconColor: NAVIGATION_ENTITIES.building.color,
        label: t('card.stats.building'),
        value: property.building,
      });
    }

    // Floor with icon
    if (property.floor !== undefined && property.floor !== null) {
      items.push({
        icon: NAVIGATION_ENTITIES.floor.icon,
        iconColor: NAVIGATION_ENTITIES.floor.color,
        label: t('card.stats.floor'),
        value: formatFloorLabel(property.floor),
      });
    }

    // Area with icon - 🏢 ENTERPRISE: Use displayArea (areas.gross ?? area)
    if (displayArea) {
      items.push({
        icon: NAVIGATION_ENTITIES.area.icon,
        iconColor: NAVIGATION_ENTITIES.area.color,
        label: t('card.stats.area'),
        value: `${formatNumber(displayArea)} m²`,
      });
    }

    // 🛏️ Bedrooms (Phase 1 Property Fields)
    if (property.layout?.bedrooms !== undefined && property.layout.bedrooms > 0) {
      items.push({
        icon: Bed,
        iconColor: 'text-violet-600',
        label: t('card.stats.bedrooms'),
        value: String(property.layout.bedrooms),
      });
    }

    // 🚿 Bathrooms (Phase 1 Property Fields)
    if (property.layout?.bathrooms !== undefined && property.layout.bathrooms > 0) {
      items.push({
        icon: Bath,
        iconColor: 'text-cyan-600',
        label: t('card.stats.bathrooms'),
        value: String(property.layout.bathrooms),
      });
    }

    // 🔧 Condition (Phase 4 Property Fields)
    if (property.condition) {
      // Color coding based on condition
      const conditionColors: Record<string, string> = {
        'new': 'text-green-600',
        'excellent': 'text-emerald-600',
        'good': 'text-blue-600',
        'needs-renovation': 'text-orange-600'
      };
      items.push({
        icon: Wrench,
        iconColor: conditionColors[property.condition] || 'text-gray-600',
        label: t('card.stats.condition'),
        value: t(`condition.${property.condition}`, { defaultValue: property.condition }),
      });
    }

    return items;
  }, [property.building, property.floor, property.area, property.areas, property.layout, property.condition, t]);

  /** Build badges from operational status */
  const badges = useMemo(() => {
    const opStatus = property.operationalStatus || 'ready';
    const labelKey = OPERATIONAL_STATUS_LABEL_KEYS[opStatus] || 'operationalStatus.ready';
    const statusLabel = t(labelKey);
    const variant = OPERATIONAL_STATUS_VARIANTS[opStatus] || 'success';

    return [{ label: statusLabel, variant }];
  }, [property.operationalStatus, t]);

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
    <GridCard
      entityType={ENTITY_TYPES.PROPERTY}
      title={property.name || property.code || property.id}
      subtitle={t(`types.${property.type}`, { defaultValue: property.type })}
      badges={badges}
      stats={stats}
      isSelected={isSelected}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      isFavorite={isFavorite}
      onToggleFavorite={onToggleFavorite}
      compact={compact}
      className={className}
      aria-label={t('card.ariaLabel', { name: property.name || property.code || property.id })}
    />
  );
}

PropertyGridCard.displayName = 'PropertyGridCard';

export default PropertyGridCard;
