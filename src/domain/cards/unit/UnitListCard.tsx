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

  /**
   * 🏢 PR1.2: Build stats array with ICONS + VALUES for compact inline display
   * Format: 🏠 Type | 📐 85 m² | 🏢 1ος
   */
  const stats = useMemo<StatItem[]>(() => {
    const items: StatItem[] = [];

    // Type with icon
    if (unit.type) {
      items.push({
        icon: NAVIGATION_ENTITIES.unit.icon, // 🏠 Unit icon for type
        iconColor: NAVIGATION_ENTITIES.unit.color,
        label: t('card.stats.type'),
        value: t(`types.${unit.type}`, { defaultValue: unit.type }),
      });
    }

    // Area with icon
    if (unit.area) {
      items.push({
        icon: NAVIGATION_ENTITIES.area.icon, // 📐 Area icon
        iconColor: NAVIGATION_ENTITIES.area.color,
        label: t('card.stats.area'),
        value: `${formatNumber(unit.area)} m²`,
      });
    }

    // Floor with icon
    if (unit.floor !== undefined && unit.floor !== null) {
      items.push({
        icon: NAVIGATION_ENTITIES.floor.icon, // 🏢 Floor icon
        iconColor: NAVIGATION_ENTITIES.floor.color,
        label: t('card.stats.floor'),
        value: formatFloorLabel(unit.floor),
      });
    }

    return items;
  }, [unit.type, unit.area, unit.floor, t]);

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

  // 🏢 PR1.2: Compact mobile-first layout (2 lines)
  // Line 1: Name + Status chip (inline)
  // Line 2: 🏠 Type | 📐 85 m² | 🏢 1ος (icons + values inline)
  return (
    <ListCard
      entityType="unit"
      title={unit.name || unit.code || unit.id}
      badges={badges}
      stats={stats}
      isSelected={isSelected}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      isFavorite={isFavorite}
      onToggleFavorite={onToggleFavorite}
      compact={true} // 🏢 PR1.2: Always compact for mobile-first
      hideStats={false} // 🏢 PR1.2: Show stats with icons + values
      inlineBadges={true} // 🏢 PR1.2: Badge inline with title
      hideIcon={true} // 🏢 PR1.2: Hide entity icon (icon-less compact)
      className={className}
      aria-label={t('card.ariaLabel', { name: unit.name || unit.code || unit.id })}
    />
  );
}

UnitListCard.displayName = 'UnitListCard';

export default UnitListCard;
