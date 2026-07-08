'use client';

/**
 * 🏠 PROPERTY CARD VIEW-MODEL HOOK (ADR-585)
 *
 * Derived model for PropertyGridCard + PropertyListCard. The two views diverge
 * more than the other entities (Grid adds bedrooms/bathrooms/condition + per-sqm
 * commercial prices; List uses a project-aware subtitle and a different status
 * map), so this hook branches on `view` while sharing the price/commercial logic
 * via property-card-shared. One file owns all Property-card logic.
 *
 * @see ADR-585 Domain card view-model hook SSoT
 */

import { useMemo } from 'react';
import { Bed, Bath, Wrench } from 'lucide-react';

import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import type { StatItem } from '@/design-system';
import type { GridCardBadge, GridCardBadgeVariant } from '@/design-system/components/GridCard/GridCard.types';
import { formatNumber, formatFloorLabel } from '@/lib/intl-utils';
import { formatCurrencyWhole } from '@/lib/intl-domain';
import { buildCardSubtitle } from '@/domain/cards/shared/card-subtitle';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { Property } from '@/types/property-viewer';
import { ENTITY_TYPES } from '@/config/domain-constants';
import '@/lib/design-system';

import type { CardViewModel } from '../shared/card-model.types';
import { buildPropertyBadges, buildPropertyPriceStats } from './property-card-shared';

type TFn = (key: string, opts?: Record<string, unknown>) => string;

// =============================================================================
// 🏢 OPERATIONAL / COMMERCIAL STATUS MAPPINGS
// =============================================================================

// Grid: operational status only.
const OPERATIONAL_STATUS_VARIANTS: Record<string, GridCardBadgeVariant> = {
  'ready': 'success',
  'under-construction': 'warning',
  'inspection': 'info',
  'maintenance': 'secondary',
  'draft': 'default',
};
const OPERATIONAL_STATUS_LABEL_KEYS: Record<string, string> = {
  'ready': 'operationalStatus.ready',
  'under-construction': 'operationalStatus.underConstruction',
  'inspection': 'operationalStatus.inspection',
  'maintenance': 'operationalStatus.maintenance',
  'draft': 'operationalStatus.draft',
};

// List: operationalStatus||status, different variant/label map.
const LIST_STATUS_BADGE_VARIANTS: Record<string, GridCardBadgeVariant> = {
  'for-rent': 'warning',
  rented: 'secondary',
  ready: 'success',
  'under-construction': 'info',
  maintenance: 'destructive',
  draft: 'default',
};
const LIST_STATUS_LABEL_KEYS: Record<string, string> = {
  'for-rent': 'status.forRent',
  rented: 'status.rented',
  ready: 'operationalStatus.ready',
  'under-construction': 'operationalStatus.underConstruction',
  maintenance: 'operationalStatus.maintenance',
  draft: 'operationalStatus.draft',
};

// =============================================================================
// 🏢 STAT BUILDERS (per-view differences preserved)
// =============================================================================

function buildingStat(property: Property, t: TFn): StatItem | null {
  if (!property.building) return null;
  return {
    icon: NAVIGATION_ENTITIES.building.icon,
    iconColor: NAVIGATION_ENTITIES.building.color,
    label: t('card.stats.building'),
    value: property.building,
  };
}

function displayAreaOf(property: Property): number | undefined {
  return property.areas?.gross || property.areas?.net || property.area;
}

// =============================================================================
// 🏢 GRID MODEL
// =============================================================================

export function usePropertyGridModel(property: Property, showCommercialPrices = false): CardViewModel {
  const { t } = useTranslation(['properties', 'properties-detail', 'properties-enums', 'properties-viewer']);

  const stats = useMemo<StatItem[]>(() => {
    const items: StatItem[] = [];
    const displayArea = displayAreaOf(property);

    const b = buildingStat(property, t);
    if (b) items.push(b);

    if (property.floor !== undefined && property.floor !== null) {
      items.push({
        icon: NAVIGATION_ENTITIES.floor.icon,
        iconColor: NAVIGATION_ENTITIES.floor.color,
        label: t('card.stats.floor'),
        value: formatFloorLabel(property.floor),
      });
    }

    if (displayArea) {
      items.push({
        icon: NAVIGATION_ENTITIES.area.icon,
        iconColor: NAVIGATION_ENTITIES.area.color,
        label: t('card.stats.area'),
        value: `${formatNumber(displayArea)} m²`,
      });
    }

    if (property.layout?.bedrooms !== undefined && property.layout.bedrooms > 0) {
      items.push({ icon: Bed, iconColor: 'text-primary', label: t('card.stats.bedrooms'), value: String(property.layout.bedrooms) });
    }
    if (property.layout?.bathrooms !== undefined && property.layout.bathrooms > 0) {
      items.push({ icon: Bath, iconColor: 'text-primary', label: t('card.stats.bathrooms'), value: String(property.layout.bathrooms) });
    }

    if (property.condition) {
      const conditionColors: Record<string, string> = {
        'new': 'text-[hsl(var(--text-success))]',
        'excellent': 'text-[hsl(var(--text-success))]',
        'good': 'text-primary',
        'needs-renovation': 'text-[hsl(var(--text-warning))]',
      };
      items.push({
        icon: Wrench,
        iconColor: conditionColors[property.condition] || 'text-muted-foreground',
        label: t('card.stats.condition'),
        value: t(`condition.${property.condition}`, { defaultValue: property.condition }),
      });
    }

    items.push(...buildPropertyPriceStats(property, t));

    // Commercial prices per sqm — sales pages only
    if (showCommercialPrices && displayArea) {
      const askingPrice = property.commercial?.askingPrice;
      const rentPrice = property.commercial?.rentPrice;
      if (askingPrice && askingPrice > 0) {
        items.push({
          icon: NAVIGATION_ENTITIES.price.icon,
          iconColor: NAVIGATION_ENTITIES.price.color,
          label: t('card.stats.salePricePerSqm'),
          value: `${formatCurrencyWhole(Math.round(askingPrice / displayArea))}/m²`,
        });
      }
      if (rentPrice && rentPrice > 0) {
        items.push({
          icon: NAVIGATION_ENTITIES.price.icon,
          iconColor: 'text-[hsl(var(--text-warning))]',
          label: t('card.stats.rentPricePerSqm'),
          value: `${formatCurrencyWhole(Math.round(rentPrice / displayArea))}/m²`,
        });
      }
    }

    return items;
  }, [property, showCommercialPrices, t]);

  const badges = useMemo<GridCardBadge[]>(() => {
    const opStatus = property.operationalStatus || 'ready';
    return buildPropertyBadges(
      OPERATIONAL_STATUS_LABEL_KEYS[opStatus] || 'operationalStatus.ready',
      OPERATIONAL_STATUS_VARIANTS[opStatus] || 'success',
      property,
      t,
    );
  }, [property, t]);

  const name = property.name || property.code || property.id;
  return {
    entityType: ENTITY_TYPES.PROPERTY,
    title: name,
    subtitle: buildCardSubtitle(t(`types.${property.type}`, { defaultValue: property.type }), property.code),
    badges,
    stats,
    ariaLabel: t('card.ariaLabel', { name }),
  };
}

// =============================================================================
// 🏢 LIST MODEL
// =============================================================================

export function usePropertyListModel(property: Property): CardViewModel {
  const { t } = useTranslation(['properties', 'properties-viewer', 'properties-enums', 'properties-detail']);

  const stats = useMemo<StatItem[]>(() => {
    const items: StatItem[] = [];

    const b = buildingStat(property, t);
    if (b) items.push(b);

    if (property.floor !== undefined) {
      items.push({
        icon: NAVIGATION_ENTITIES.floor.icon,
        iconColor: NAVIGATION_ENTITIES.floor.color,
        label: t('card.stats.floor'),
        value: formatFloorLabel(property.floor),
      });
    }

    const displayArea = displayAreaOf(property);
    if (displayArea) {
      items.push({
        icon: NAVIGATION_ENTITIES.area.icon,
        iconColor: NAVIGATION_ENTITIES.area.color,
        label: t('card.stats.area'),
        value: `${displayArea} m²`,
      });
    }

    items.push(...buildPropertyPriceStats(property, t));

    return items;
  }, [property, t]);

  const badges = useMemo<GridCardBadge[]>(() => {
    const status = property.operationalStatus || property.status || 'ready';
    return buildPropertyBadges(
      LIST_STATUS_LABEL_KEYS[status] || 'operationalStatus.ready',
      LIST_STATUS_BADGE_VARIANTS[status] || 'success',
      property,
      t,
    );
  }, [property, t]);

  const subtitle = useMemo(() => {
    const parts: string[] = [];
    if (property.type) {
      const typeLabel = t(`types.${property.type}`, { ns: 'properties', defaultValue: property.type });
      parts.push(buildCardSubtitle(typeLabel, property.code));
    }
    if (property.project) parts.push(property.project);
    return parts.join(' • ') || undefined;
  }, [property.type, property.code, property.project, t]);

  const name = property.name || property.id;
  return {
    entityType: ENTITY_TYPES.PROPERTY,
    title: name,
    subtitle,
    badges,
    stats,
    ariaLabel: t('card.ariaLabel', { name }),
  };
}
