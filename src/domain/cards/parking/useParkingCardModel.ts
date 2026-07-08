'use client';

/**
 * 🅿️ PARKING CARD VIEW-MODEL HOOK (ADR-585)
 *
 * Shared derived model for ParkingGridCard + ParkingListCard. Stats are
 * identical across views; the badge/type i18n key namespaces differ per view
 * (Grid uses `general.statuses.*` / `general.types.*`, List uses `status.*` /
 * `types.*`) — that pre-existing inconsistency is preserved via the `view` arg.
 *
 * @see ADR-585 Domain card view-model hook SSoT
 */

import { useMemo } from 'react';

import type { StatItem } from '@/design-system';
import type { GridCardBadgeVariant } from '@/design-system/components/GridCard/GridCard.types';
import { buildCardSubtitle } from '@/domain/cards/shared/card-subtitle';
import { useTranslation } from '@/i18n/hooks/useTranslation';

import { floorStat, areaStat, priceStat } from '../shared/spot-card-stats';
import type { CardViewModel } from '../shared/card-model.types';
import type { ParkingSpotAdapter } from './parking-types';

const STATUS_BADGE_VARIANTS: Record<string, GridCardBadgeVariant> = {
  available: 'success',
  occupied: 'info',
  reserved: 'warning',
  sold: 'secondary',
  maintenance: 'destructive',
};

/**
 * Build the shared Parking card view-model. `view` selects the i18n key
 * namespace to reproduce the exact per-view labels.
 */
export function useParkingCardModel(parking: ParkingSpotAdapter, view: 'grid' | 'list'): CardViewModel {
  const { t } = useTranslation('parking');

  const statusPrefix = view === 'grid' ? 'general.statuses' : 'status';
  const typePrefix = view === 'grid' ? 'general.types' : 'types';

  /** Build stats array (identical across views): level → area → price */
  const stats = useMemo<StatItem[]>(() => {
    return [
      floorStat(parking.level || parking.floor, t('card.stats.level')),
      areaStat(parking.area, t('card.stats.area')),
      priceStat(parking.price, t('card.stats.price')),
    ].filter((s): s is StatItem => s !== null);
  }, [parking.level, parking.floor, parking.area, parking.price, t]);

  /** Build badges from status */
  const badges = useMemo(() => {
    const status = parking.status || 'available';
    const statusLabel = t(`${statusPrefix}.${status}`, { defaultValue: status });
    const variant = STATUS_BADGE_VARIANTS[status] || 'default';

    return [{ label: statusLabel, variant }];
  }, [parking.status, statusPrefix, t]);

  /** Get type label for subtitle */
  const typeLabel = useMemo(() => {
    const type = parking.type || 'standard';
    return t(`${typePrefix}.${type}`, { defaultValue: type });
  }, [parking.type, typePrefix, t]);

  // ADR-233: number = human title (e.g. "Θέση 1"), code = system identifier in subtitle
  const title = parking.number || parking.code || parking.id;

  return {
    entityType: 'parking',
    title,
    subtitle: buildCardSubtitle(typeLabel, parking.code),
    badges,
    stats,
    ariaLabel: t('card.ariaLabel', { name: title }),
  };
}
