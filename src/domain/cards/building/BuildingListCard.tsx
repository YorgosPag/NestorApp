'use client';

/**
 * 🏢 ENTERPRISE BUILDING LIST CARD - Domain Component
 *
 * Domain-specific card for buildings in list views.
 * Extends ListCard with building-specific defaults and stats.
 *
 * @fileoverview Building domain card using centralized ListCard.
 * @enterprise Fortune 500 compliant - ZERO hardcoded values
 * @see ListCard for base component
 * @see NAVIGATION_ENTITIES for entity config
 * @author Enterprise Architecture Team
 * @since 2026-01-08
 */

import React, { useMemo } from 'react';
import { Ruler, Layers, Home } from 'lucide-react';

// 🏢 DESIGN SYSTEM
import { ListCard } from '@/design-system';
import type { StatItem } from '@/design-system';

// 🏢 CENTRALIZED FORMATTERS
import { formatNumber } from '@/lib/intl-utils';

// 🏢 DOMAIN TYPES
import type { Building } from '@/types/building/contracts';

// 🏢 BADGE VARIANT MAPPING
import type { ListCardBadgeVariant } from '@/design-system/components/ListCard/ListCard.types';

// =============================================================================
// 🏢 TYPES
// =============================================================================

export interface BuildingListCardProps {
  /** Building data */
  building: Building;
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
  planning: 'warning',
  construction: 'info',
  completed: 'success',
  active: 'success',
};

// =============================================================================
// 🏢 STATUS LABELS (Greek)
// =============================================================================

const STATUS_LABELS: Record<string, string> = {
  planning: 'Σχεδιασμός',
  construction: 'Κατασκευή',
  completed: 'Ολοκληρωμένο',
  active: 'Ενεργό',
};

// =============================================================================
// 🏢 CATEGORY LABELS (Greek)
// =============================================================================

const CATEGORY_LABELS: Record<string, string> = {
  mixed: 'Μικτό',
  residential: 'Κατοικίες',
  commercial: 'Εμπορικό',
  industrial: 'Βιομηχανικό',
};

// =============================================================================
// 🏢 COMPONENT
// =============================================================================

/**
 * 🏢 BuildingListCard Component
 *
 * Domain-specific card for buildings.
 * Uses ListCard with building defaults from NAVIGATION_ENTITIES.
 *
 * @example
 * ```tsx
 * <BuildingListCard
 *   building={building}
 *   isSelected={selectedId === building.id}
 *   onSelect={() => setSelectedId(building.id)}
 *   onToggleFavorite={() => toggleFavorite(building.id)}
 *   isFavorite={favorites.has(building.id)}
 * />
 * ```
 */
export function BuildingListCard({
  building,
  isSelected = false,
  isFavorite,
  onSelect,
  onToggleFavorite,
  compact = false,
  className,
}: BuildingListCardProps) {
  // ==========================================================================
  // 🏢 COMPUTED VALUES (Memoized)
  // ==========================================================================

  /** Build stats array from building data */
  const stats = useMemo<StatItem[]>(() => {
    const items: StatItem[] = [];

    // Total Area
    if (building.totalArea) {
      items.push({
        icon: Ruler,
        label: 'Συν. Εμβαδόν',
        value: `${formatNumber(building.totalArea)} m²`,
      });
    }

    // Floors
    if (building.floors) {
      items.push({
        icon: Layers,
        label: 'Όροφοι',
        value: String(building.floors),
      });
    }

    // Units
    if (building.units) {
      items.push({
        icon: Home,
        label: 'Μονάδες',
        value: String(building.units),
      });
    }

    return items;
  }, [building.totalArea, building.floors, building.units]);

  /** Build badges from status */
  const badges = useMemo(() => {
    const status = building.status || 'planning';
    const statusLabel = STATUS_LABELS[status] || status;
    const variant = STATUS_BADGE_VARIANTS[status] || 'default';

    return [{ label: statusLabel, variant }];
  }, [building.status]);

  /** Get category label for subtitle */
  const categoryLabel = useMemo(() => {
    const category = building.category || 'mixed';
    return CATEGORY_LABELS[category] || category;
  }, [building.category]);

  // ==========================================================================
  // 🏢 RENDER
  // ==========================================================================

  return (
    <ListCard
      entityType="building"
      title={building.name || building.id}
      subtitle={categoryLabel}
      badges={badges}
      stats={stats}
      isSelected={isSelected}
      onClick={onSelect}
      isFavorite={isFavorite}
      onToggleFavorite={onToggleFavorite}
      compact={compact}
      className={className}
      aria-label={`Κτίριο ${building.name || building.id}`}
    />
  );
}

BuildingListCard.displayName = 'BuildingListCard';

export default BuildingListCard;
