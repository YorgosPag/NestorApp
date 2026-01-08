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
import { Ruler, Euro, Building2 } from 'lucide-react';

// 🏢 DESIGN SYSTEM
import { ListCard } from '@/design-system';
import type { StatItem } from '@/design-system';

// 🏢 CENTRALIZED FORMATTERS
import { formatCurrency } from '@/lib/intl-utils';

// 🏢 DOMAIN TYPES
import type { Storage } from '@/types/storage/contracts';

// 🏢 BADGE VARIANT MAPPING
import type { ListCardBadgeVariant } from '@/design-system/components/ListCard/ListCard.types';

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
// 🏢 STATUS LABELS (Greek)
// =============================================================================

const STATUS_LABELS: Record<string, string> = {
  available: 'Διαθέσιμη',
  occupied: 'Κατειλημμένη',
  reserved: 'Κρατημένη',
  maintenance: 'Συντήρηση',
};

// =============================================================================
// 🏢 TYPE LABELS (Greek)
// =============================================================================

const TYPE_LABELS: Record<string, string> = {
  large: 'Μεγάλη',
  small: 'Μικρή',
  basement: 'Υπόγεια',
  ground: 'Ισόγεια',
  special: 'Ειδική',
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
  // ==========================================================================
  // 🏢 COMPUTED VALUES (Memoized)
  // ==========================================================================

  /** Build stats array from storage data */
  const stats = useMemo<StatItem[]>(() => {
    const items: StatItem[] = [];

    // Area
    if (storage.area) {
      items.push({
        icon: Ruler,
        label: 'Εμβαδόν',
        value: `${storage.area} m²`,
      });
    }

    // Price
    if (storage.price && storage.price > 0) {
      items.push({
        icon: Euro,
        label: 'Τιμή',
        value: formatCurrency(storage.price, 'EUR', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }),
      });
    }

    // Floor
    if (storage.floor) {
      items.push({
        icon: Building2,
        label: 'Όροφος',
        value: storage.floor,
      });
    }

    return items;
  }, [storage.area, storage.price, storage.floor]);

  /** Build badges from status */
  const badges = useMemo(() => {
    const status = storage.status || 'available';
    const statusLabel = STATUS_LABELS[status] || status;
    const variant = STATUS_BADGE_VARIANTS[status] || 'default';

    return [{ label: statusLabel, variant }];
  }, [storage.status]);

  /** Get type label for subtitle */
  const typeLabel = useMemo(() => {
    const type = storage.type || 'small';
    return TYPE_LABELS[type] || type;
  }, [storage.type]);

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
      aria-label={`Αποθήκη ${storage.name || storage.id}`}
    />
  );
}

StorageListCard.displayName = 'StorageListCard';

export default StorageListCard;
