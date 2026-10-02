'use client';

/**
 * 🏢 BUILDING CARD VIEW-MODEL HOOK (ADR-585)
 *
 * Computes the shared, view-agnostic props consumed by BOTH BuildingGridCard
 * and BuildingListCard. Extracted from the previously-duplicated computation
 * block (jscpd twin).
 *
 * @see ADR-585 Domain card view-model hook SSoT
 */

import { useMemo } from 'react';

import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import type { StatItem } from '@/design-system';
import type { GridCardBadgeVariant } from '@/design-system/components/GridCard/GridCard.types';
import { formatNumber } from '@/lib/intl-utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { Building } from '@/types/building/contracts';
import { formatBuildingLabel } from '@/lib/entity-formatters';
import { buildingCategoryLabel, buildingStatusLabel } from '@/lib/buildings/building-enum-labels';
import { parseBuildingStatus, type BuildingStatus } from '@/constants/building-statuses';
import { ENTITY_TYPES } from '@/config/domain-constants';
import '@/lib/design-system';

import type { CardViewModel } from '../shared/card-model.types';

// =============================================================================
// 🏢 STATUS TO BADGE VARIANT MAPPING (Centralized)
// =============================================================================

const STATUS_BADGE_VARIANTS: Readonly<Record<BuildingStatus, GridCardBadgeVariant>> = {
  planning: 'warning',
  construction: 'info',
  completed: 'success',
  active: 'success',
  deleted: 'default',
};

/**
 * Build the shared Building card view-model (title, subtitle, badges, stats, aria).
 */
export function useBuildingCardModel(building: Building): CardViewModel {
  const { t } = useTranslation(['building', 'building-address', 'building-filters', 'building-storage', 'building-tabs', 'building-timeline']);

  /** Build stats array from building data */
  const stats = useMemo<StatItem[]>(() => {
    const items: StatItem[] = [];

    // Total Area - 🏢 ENTERPRISE: Using centralized area icon/color + i18n
    if (building.totalArea) {
      items.push({
        icon: NAVIGATION_ENTITIES.area.icon,
        iconColor: NAVIGATION_ENTITIES.area.color,
        label: t('card.metrics.totalArea'),
        value: `${formatNumber(building.totalArea)} m²`,
      });
    }

    // Floors - 🏢 ENTERPRISE: Using i18n
    if (building.floors) {
      items.push({
        icon: NAVIGATION_ENTITIES.floor.icon,
        iconColor: NAVIGATION_ENTITIES.floor.color,
        label: t('card.metrics.floors'),
        value: String(building.floors),
      });
    }

    // Units - 🏢 ENTERPRISE: Using i18n
    if (building.units) {
      items.push({
        icon: NAVIGATION_ENTITIES.property.icon,
        iconColor: NAVIGATION_ENTITIES.property.color,
        label: t('card.metrics.units'),
        value: String(building.units),
      });
    }

    return items;
  }, [building.totalArea, building.floors, building.units, t]);

  /** Build badges from status - 🏢 ENTERPRISE: Using centralized i18n */
  const badges = useMemo(() => {
    const status = parseBuildingStatus(building.status);
    const variant: GridCardBadgeVariant = status === null ? 'default' : STATUS_BADGE_VARIANTS[status];
    return [{ label: buildingStatusLabel(t, building.status), variant }];
  }, [building.status, t]);

  /** Get category label for subtitle - 🏢 ENTERPRISE: Using centralized i18n */
  const categoryLabel = useMemo(() => buildingCategoryLabel(t, building.category), [building.category, t]);

  return {
    entityType: ENTITY_TYPES.BUILDING,
    title: formatBuildingLabel(building.code, building.name, building.id),
    subtitle: categoryLabel,
    badges,
    stats,
    ariaLabel: t('accessibility.buildingCard', { name: building.name || building.id }),
  };
}
