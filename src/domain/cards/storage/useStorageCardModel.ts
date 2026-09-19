'use client';

/**
 * 📦 STORAGE CARD VIEW-MODEL HOOK (ADR-585)
 *
 * Shared derived model for StorageGridCard + StorageListCard. Badges, subtitle,
 * title and aria are identical across views; only the stat ordering differs
 * (Grid: floor→area→price, List: area→price→floor) — preserved via `view`.
 *
 * @see ADR-585 Domain card view-model hook SSoT
 */

import { useMemo } from 'react';

import type { StatItem } from '@/design-system';
import { buildCardSubtitle } from '@/domain/cards/shared/card-subtitle';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { spaceStatusBadges, UNIT_STATUS_NAMESPACE } from '@/lib/units/unit-status-badges';
import type { Storage } from '@/types/storage/contracts';

import { floorStat, areaStat, priceStat } from '../shared/spot-card-stats';
import type { CardViewModel } from '../shared/card-model.types';

// =============================================================================
// 🏢 STATUS / TYPE MAPPINGS (Shared Grid + List)
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

/**
 * Build the shared Storage card view-model. Stat order follows the view.
 */
export function useStorageCardModel(storage: Storage, view: 'grid' | 'list'): CardViewModel {
  const { t } = useTranslation(['storage', UNIT_STATUS_NAMESPACE]);

  /** Build stats — Grid: floor→area→price, List: area→price→floor */
  const stats = useMemo<StatItem[]>(() => {
    const floor = floorStat(storage.floor, t('card.stats.floor'));
    const area = areaStat(storage.area, t('card.stats.area'));
    const price = priceStat(storage, t('card.stats.price'), t);
    const ordered = view === 'grid' ? [floor, area, price] : [area, price, floor];
    return ordered.filter((s): s is StatItem => s !== null);
  }, [storage, view, t]);

  /** Διάθεση (από το `commercialStatus`) + λειτουργική εξαίρεση — ποτέ το παλιό ανάμεικτο πεδίο. */
  const badges = useMemo(() => spaceStatusBadges(storage, t), [storage, t]);

  /** Get type label for subtitle */
  const typeLabel = useMemo(() => {
    const type = storage.type || 'small';
    const labelKey = TYPE_LABEL_KEYS[type] || 'types.unknown';
    return t(labelKey);
  }, [storage.type, t]);

  return {
    entityType: 'storage',
    title: storage.name || storage.id,
    subtitle: buildCardSubtitle(typeLabel, storage.code),
    badges,
    stats,
    ariaLabel: t('card.ariaLabel', { name: storage.name || storage.id }),
  };
}
