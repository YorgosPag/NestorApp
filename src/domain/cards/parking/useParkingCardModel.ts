'use client';

/**
 * 🅿️ PARKING CARD VIEW-MODEL HOOK (ADR-585)
 *
 * Shared derived model for ParkingGridCard + ParkingListCard. Stats are
 * identical across views; the type i18n key namespaces differ per view
 * (Grid uses `general.types.*`, List uses `types.*`) — preserved via the `view` arg.
 * Τα σήματα κατάστασης έρχονται από το ΕΝΑ SSoT των μονάδων (ADR-777 §8.60.20).
 *
 * @see ADR-585 Domain card view-model hook SSoT
 */

import { useMemo } from 'react';

import type { StatItem } from '@/design-system';
import { buildCardSubtitle } from '@/domain/cards/shared/card-subtitle';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { spaceStatusBadges, UNIT_STATUS_NAMESPACE } from '@/lib/units/unit-status-badges';

import { floorStat, areaStat, priceStat } from '../shared/spot-card-stats';
import type { CardViewModel } from '../shared/card-model.types';
import type { ParkingSpotAdapter } from './parking-types';

/**
 * Build the shared Parking card view-model. `view` selects the i18n key
 * namespace to reproduce the exact per-view labels.
 */
export function useParkingCardModel(parking: ParkingSpotAdapter, view: 'grid' | 'list'): CardViewModel {
  const { t } = useTranslation(['parking', UNIT_STATUS_NAMESPACE]);

  const typePrefix = view === 'grid' ? 'general.types' : 'types';

  /** Build stats array (identical across views): level → area → price */
  const stats = useMemo<StatItem[]>(() => {
    return [
      floorStat(parking.level || parking.floor, t('card.stats.level')),
      areaStat(parking.area, t('card.stats.area')),
      priceStat(parking, t('card.stats.price'), t),
    ].filter((s): s is StatItem => s !== null);
  }, [parking, t]);

  /** Διάθεση (από το `commercialStatus`) + λειτουργική εξαίρεση — ποτέ το παλιό ανάμεικτο πεδίο. */
  const badges = useMemo(() => spaceStatusBadges(parking, t), [parking, t]);

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
