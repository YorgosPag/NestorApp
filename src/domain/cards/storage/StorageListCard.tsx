// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
'use client';

/**
 * 📦 ENTERPRISE STORAGE LIST CARD - Domain Component
 *
 * Domain-specific card for storage units in list views.
 * Extends ListCard with storage-specific defaults and stats.
 *
 * @fileoverview Storage domain card using centralized ListCard.
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
import { formatCurrency } from '@/lib/intl-utils';

// 🏢 DOMAIN TYPES
import type { Storage } from '@/types/storage/contracts';

// 🏢 BADGE VARIANT MAPPING
import type { ListCardBadgeVariant } from '@/design-system/components/ListCard/ListCard.types';

// 🏢 ENTERPRISE: i18n support
import { useTranslation } from 'react-i18next';

// =============================================================================
// 🏢 TYPES
// =============================================================================

export interface StorageListCardProps {
  /** Storage unit data */
  storage: Storage;
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
// 🏢 TYPE LABELS (i18n keys)
// =============================================================================

const TYPE_LABEL_KEYS: Record<string, string> = {
  large: 'types.large',
  small: 'types.small',
  basement: 'types.basement',
  ground: 'types.ground',
  special: 'types.special',
};

// =============================================================================
// 🏢 COMPONENT
// =============================================================================

/**
 * 📦 StorageListCard Component
 *
 * Domain-specific card for storage units.
 * Uses ListCard with storage defaults from NAVIGATION_ENTITIES.
 *
 * @example
 * ```tsx
 * <StorageListCard
 *   storage={storageUnit}
 *   isSelected={selectedId === storageUnit.id}
 *   onSelect={() => setSelectedId(storageUnit.id)}
 *   onToggleFavorite={() => toggleFavorite(storageUnit.id)}
 *   isFavorite={favorites.has(storageUnit.id)}
 * />
 * ```
 */
export function StorageListCard({
  storage,
  isSelected = false,
  isFavorite,
  onSelect,
  onToggleFavorite,
  compact = false,
  className,
}: StorageListCardProps) {
  const { t } = useTranslation('storage');

  // ==========================================================================
  // 🏢 COMPUTED VALUES (Memoized)
  // ==========================================================================

  /** Build stats array from storage data */
  const stats = useMemo<StatItem[]>(() => {
    const items: StatItem[] = [];

    // Area - 🏢 ENTERPRISE: Using centralized area icon/color
    if (storage.area) {
      items.push({
        icon: NAVIGATION_ENTITIES.area.icon,
        iconColor: NAVIGATION_ENTITIES.area.color,
        label: t('card.stats.area'),
        value: `${storage.area} m²`,
      });
    }

    // Price - 🏢 ENTERPRISE: Using centralized price icon/color
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

    // Floor
    if (storage.floor) {
      items.push({
        icon: NAVIGATION_ENTITIES.floor.icon,
        iconColor: NAVIGATION_ENTITIES.floor.color,
        label: t('card.stats.floor'),
        value: storage.floor,
      });
    }

    return items;
  }, [storage.area, storage.price, storage.floor, t]);

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
  // 🏢 RENDER
  // ==========================================================================

  return (
    <ListCard
      entityType="storage"
      title={storage.name || storage.id}
      subtitle={typeLabel}
      badges={badges}
      stats={stats}
      isSelected={isSelected}
      onClick={onSelect}
      isFavorite={isFavorite}
      onToggleFavorite={onToggleFavorite}
      compact={compact}
      className={className}
      aria-label={t('card.ariaLabel', { name: storage.name || storage.id })}
    />
  );
}

StorageListCard.displayName = 'StorageListCard';

export default StorageListCard;
