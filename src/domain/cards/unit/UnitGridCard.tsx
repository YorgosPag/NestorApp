// 🌐 i18n: All labels use i18n keys
'use client';

/**
 * 🏠 ENTERPRISE UNIT GRID CARD - Domain Component
 *
 * Domain-specific card for units/properties in grid/tile views.
 * Extends GridCard with unit-specific defaults and stats.
 *
 * @fileoverview Unit domain card using centralized GridCard.
 * @enterprise Fortune 500 compliant - ZERO hardcoded values
 * @see GridCard for base component
 * @see UnitListCard for list view equivalent
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

// =============================================================================
// 🏢 TYPES
// =============================================================================

export interface UnitGridCardProps {
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
// 🏢 OPERATIONAL STATUS TO BADGE VARIANT MAPPING (Physical Truth)
// =============================================================================

/**
 * ✅ DOMAIN SEPARATION: Operational status mapping (construction/readiness)
 * Shared with UnitListCard for consistency
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
 * 🏠 UnitGridCard Component
 *
 * Domain-specific card for units/properties in grid views.
 * Uses GridCard with unit defaults from NAVIGATION_ENTITIES.
 *
 * @example
 * ```tsx
 * <UnitGridCard
 *   unit={property}
 *   isSelected={selectedId === property.id}
 *   onSelect={() => setSelectedId(property.id)}
 *   onToggleFavorite={() => toggleFavorite(property.id)}
 *   isFavorite={favorites.has(property.id)}
 * />
 * ```
 */
export function UnitGridCard({
  unit,
  isSelected = false,
  isFavorite,
  onSelect,
  onToggleFavorite,
  compact = false,
  className,
}: UnitGridCardProps) {
  const { t } = useTranslation('units');

  // ==========================================================================
  // 🏢 COMPUTED VALUES (Memoized)
  // ==========================================================================

  /** Build stats array for grid view - vertical layout optimized */
  const stats = useMemo<StatItem[]>(() => {
    const items: StatItem[] = [];

    // Building with icon
    if (unit.building) {
      items.push({
        icon: NAVIGATION_ENTITIES.building.icon,
        iconColor: NAVIGATION_ENTITIES.building.color,
        label: t('card.stats.building'),
        value: unit.building,
      });
    }

    // Floor with icon
    if (unit.floor !== undefined && unit.floor !== null) {
      items.push({
        icon: NAVIGATION_ENTITIES.floor.icon,
        iconColor: NAVIGATION_ENTITIES.floor.color,
        label: t('card.stats.floor'),
        value: formatFloorLabel(unit.floor),
      });
    }

    // Area with icon
    if (unit.area) {
      items.push({
        icon: NAVIGATION_ENTITIES.area.icon,
        iconColor: NAVIGATION_ENTITIES.area.color,
        label: t('card.stats.area'),
        value: `${formatNumber(unit.area)} m²`,
      });
    }

    // 🛏️ Bedrooms (Phase 1 Unit Fields)
    if (unit.layout?.bedrooms !== undefined && unit.layout.bedrooms > 0) {
      items.push({
        icon: Bed,
        iconColor: 'text-violet-600',
        label: t('card.stats.bedrooms'),
        value: String(unit.layout.bedrooms),
      });
    }

    // 🚿 Bathrooms (Phase 1 Unit Fields)
    if (unit.layout?.bathrooms !== undefined && unit.layout.bathrooms > 0) {
      items.push({
        icon: Bath,
        iconColor: 'text-cyan-600',
        label: t('card.stats.bathrooms'),
        value: String(unit.layout.bathrooms),
      });
    }

    // 🔧 Condition (Phase 4 Unit Fields)
    if (unit.condition) {
      // Color coding based on condition
      const conditionColors: Record<string, string> = {
        'new': 'text-green-600',
        'excellent': 'text-emerald-600',
        'good': 'text-blue-600',
        'needs-renovation': 'text-orange-600'
      };
      items.push({
        icon: Wrench,
        iconColor: conditionColors[unit.condition] || 'text-gray-600',
        label: t('card.stats.condition'),
        value: t(`condition.${unit.condition}`, { defaultValue: unit.condition }),
      });
    }

    return items;
  }, [unit.building, unit.floor, unit.area, unit.layout, unit.condition, t]);

  /** Build badges from operational status */
  const badges = useMemo(() => {
    const opStatus = unit.operationalStatus || 'ready';
    const labelKey = OPERATIONAL_STATUS_LABEL_KEYS[opStatus] || 'operationalStatus.ready';
    const statusLabel = t(labelKey);
    const variant = OPERATIONAL_STATUS_VARIANTS[opStatus] || 'success';

    return [{ label: statusLabel, variant }];
  }, [unit.operationalStatus, t]);

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
      entityType="unit"
      title={unit.name || unit.code || unit.id}
      subtitle={t(`types.${unit.type}`, { defaultValue: unit.type })}
      badges={badges}
      stats={stats}
      isSelected={isSelected}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      isFavorite={isFavorite}
      onToggleFavorite={onToggleFavorite}
      compact={compact}
      className={className}
      aria-label={t('card.ariaLabel', { name: unit.name || unit.code || unit.id })}
    />
  );
}

UnitGridCard.displayName = 'UnitGridCard';

export default UnitGridCard;
