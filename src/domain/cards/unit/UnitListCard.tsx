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
import { formatNumber, formatFloorLabel } from '@/lib/intl-utils';

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
// 🏢 OPERATIONAL STATUS TO BADGE VARIANT MAPPING (Physical Truth)
// =============================================================================

/**
 * ✅ DOMAIN SEPARATION: Operational status mapping (construction/readiness)
 * Removed sales status mapping (for-sale/sold/reserved) per ChatGPT guidance
 *
 * @migration PR1 - Units List Cleanup
 */
const OPERATIONAL_STATUS_VARIANTS: Record<string, ListCardBadgeVariant> = {
  'ready': 'success',              // Έτοιμο
  'under-construction': 'warning', // υπό ολοκλήρωση
  'inspection': 'info',            // σε επιθεώρηση
  'maintenance': 'secondary',      // υπό συντήρηση
  'draft': 'default',              // πρόχειρο
};

// =============================================================================
// 🏢 OPERATIONAL STATUS LABELS (i18n keys)
// =============================================================================

/**
 * ✅ DOMAIN SEPARATION: Operational status i18n keys
 * Removed sales status keys per domain separation
 */
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

    // Floor - 🏢 PR1.2: Added for Google-grade density
    if (unit.floor !== undefined && unit.floor !== null) {
      items.push({
        icon: NAVIGATION_ENTITIES.floor.icon,
        iconColor: NAVIGATION_ENTITIES.floor.color,
        label: t('card.stats.floor'),
        value: formatFloorLabel(unit.floor),
      });
    }

    // ❌ REMOVED: Price display (commercial data - domain separation)
    // Price now belongs to SalesAsset type in /sales module
    // Migration: PR1 - Units List Cleanup

    return items;
  }, [unit.area, unit.floor, t]);

  /** Build badges from operational status */
  const badges = useMemo(() => {
    // ✅ DOMAIN SEPARATION: Use operationalStatus (physical state)
    // Fallback to 'ready' if not set (most units are construction-complete)
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
    <ListCard
      entityType="unit"
      title={unit.name || unit.id}
      subtitle={unit.type ? t(`types.${unit.type}`) : undefined}
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
