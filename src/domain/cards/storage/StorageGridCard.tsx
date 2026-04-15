// 🌐 i18n: All labels use i18n keys
'use client';

/**
 * 📦 ENTERPRISE STORAGE GRID CARD - Domain Component
 *
 * Domain-specific card for storage units in grid/tile views.
 * Extends GridCard with storage-specific defaults and stats.
 *
 * @fileoverview Storage domain card using centralized GridCard.
 * @enterprise Fortune 500 compliant - ZERO hardcoded values
 * @see GridCard for base component
 * @see StorageListCard for list view equivalent
 * @see NAVIGATION_ENTITIES for entity config
 * @author Enterprise Architecture Team
 * @since 2026-01-24
 */

import React, { useMemo } from 'react';
// 🏢 ENTERPRISE: All icons from centralized NAVIGATION_ENTITIES
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';

// 🏢 DESIGN SYSTEM
import { GridCard } from '@/design-system';
import type { StatItem } from '@/design-system';

// 🏢 CENTRALIZED FORMATTERS
import { formatCurrency, formatFloorString } from '@/lib/intl-utils';
import { buildCardSubtitle } from '@/domain/cards/shared/card-subtitle';

// 🏢 DOMAIN TYPES
import type { Storage } from '@/types/storage/contracts';

// 🏢 BADGE VARIANT MAPPING
import type { GridCardBadgeVariant } from '@/design-system/components/GridCard/GridCard.types';

// 🏢 ENTERPRISE: i18n support (using custom hook with lazy loading)
import { useTranslation } from '@/i18n/hooks/useTranslation';
import '@/lib/design-system';

// =============================================================================
// 🏢 TYPES
// =============================================================================

export interface StorageGridCardProps {
  /** Storage unit data */
  storage: Storage;
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
// 🏢 STATUS TO BADGE VARIANT MAPPING (Shared with StorageListCard)
// =============================================================================

const STATUS_BADGE_VARIANTS: Record<string, GridCardBadgeVariant> = {
  available: 'success',
  occupied: 'info',
  reserved: 'warning',
  maintenance: 'destructive',
};

// =============================================================================
// 🏢 STATUS LABELS (i18n keys)
// =============================================================================

const STATUS_LABEL_KEYS: Record<string, string> = {
  available: 'status.available',
  occupied: 'status.occupied',
  reserved: 'status.reserved',
  maintenance: 'status.maintenance',
};

// =============================================================================
// 🏢 TYPE LABELS (i18n keys) - Consistent with StorageListCard
// =============================================================================

const TYPE_LABEL_KEYS: Record<string, string> = {
  storage: 'types.storage',
  large: 'types.large',
  small: 'types.small',
  basement: 'types.basement',
  ground: 'types.ground',
  special: 'types.special',
  garage: 'types.garage',
  warehouse: 'types.warehouse',
};

// =============================================================================
// 🏢 COMPONENT
// =============================================================================

/**
 * 📦 StorageGridCard Component
 *
 * Domain-specific card for storage units in grid views.
 * Uses GridCard with storage defaults from NAVIGATION_ENTITIES.
 *
 * @example
 * ```tsx
 * <StorageGridCard
 *   storage={storageUnit}
 *   isSelected={selectedId === storageUnit.id}
 *   onSelect={() => setSelectedId(storageUnit.id)}
 *   onToggleFavorite={() => toggleFavorite(storageUnit.id)}
 *   isFavorite={favorites.has(storageUnit.id)}
 * />
 * ```
 */
export function StorageGridCard({
  storage,
  isSelected = false,
  isFavorite,
  onSelect,
  onToggleFavorite,
  compact = false,
  className,
}: StorageGridCardProps) {
  const { t } = useTranslation('storage');

  // ==========================================================================
  // 🏢 COMPUTED VALUES (Memoized)
  // ==========================================================================

  /** Build stats array for grid view - vertical layout optimized */
  const stats = useMemo<StatItem[]>(() => {
    const items: StatItem[] = [];

    // Floor with icon - 🏢 ENTERPRISE: Using formatFloorString for consistent localization
    if (storage.floor) {
      items.push({
        icon: NAVIGATION_ENTITIES.floor.icon,
        iconColor: NAVIGATION_ENTITIES.floor.color,
        label: t('card.stats.floor'),
        value: formatFloorString(storage.floor),
      });
    }

    // Area with icon
    if (storage.area) {
      items.push({
        icon: NAVIGATION_ENTITIES.area.icon,
        iconColor: NAVIGATION_ENTITIES.area.color,
        label: t('card.stats.area'),
        value: `${storage.area} m²`,
      });
    }

    // Price with icon (optional - may not be shown in grid view)
    if (storage.price && storage.price > 0) {
      items.push({
        icon: NAVIGATION_ENTITIES.price.icon,
        iconColor: NAVIGATION_ENTITIES.price.color,
        label: t('card.stats.price'),
        value: formatCurrency(storage.price, 'EUR', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }),
        valueColor: NAVIGATION_ENTITIES.price.color,
      });
    }

    return items;
  }, [storage.floor, storage.area, storage.price, t]);

  /** Build badges from status */
  const badges = useMemo(() => {
    const status = storage.status || 'available';
    const labelKey = STATUS_LABEL_KEYS[status] || 'status.unknown';
    const statusLabel = t(labelKey);
    const variant = STATUS_BADGE_VARIANTS[status] || 'default';

    return [{ label: statusLabel, variant }];
  }, [storage.status, t]);

  /** Get type label for subtitle */
  const typeLabel = useMemo(() => {
    const type = storage.type || 'small';
    const labelKey = TYPE_LABEL_KEYS[type] || 'types.unknown';
    return t(labelKey);
  }, [storage.type, t]);

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
      entityType="storage"
      title={storage.name || storage.id}
      subtitle={buildCardSubtitle(typeLabel, storage.code)}
      badges={badges}
      stats={stats}
      isSelected={isSelected}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      isFavorite={isFavorite}
      onToggleFavorite={onToggleFavorite}
      compact={compact}
      className={className}
      aria-label={t('card.ariaLabel', { name: storage.name || storage.id })}
    />
  );
}

StorageGridCard.displayName = 'StorageGridCard';

export default StorageGridCard;
