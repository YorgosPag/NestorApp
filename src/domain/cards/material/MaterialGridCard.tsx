'use client';

/**
 * 🏢 ENTERPRISE MATERIAL GRID CARD - Domain Component
 *
 * Domain-specific card for materials in grid/tile views.
 * Extends GridCard with material-specific defaults and price stats.
 *
 * @fileoverview Material domain card using centralized GridCard.
 * @see GridCard for base component
 * @see MaterialListCard for list view equivalent
 */

import React, { useMemo } from 'react';
import { Layers, DollarSign, TrendingUp, Calendar } from 'lucide-react';

import { GridCard } from '@/design-system';
import type { StatItem } from '@/design-system';
import type {
  GridCardBadge,
  GridCardBadgeVariant,
} from '@/design-system/components/GridCard/GridCard.types';

import { formatCurrency, formatDate } from '@/lib/intl-formatting';
import { useTranslation } from '@/i18n/hooks/useTranslation';

import type { Material } from '@/subapps/procurement/types/material';

export interface MaterialGridCardProps {
  material: Material;
  isSelected?: boolean;
  onSelect?: () => void;
  compact?: boolean;
  className?: string;
}

export function MaterialGridCard({
  material,
  isSelected = false,
  onSelect,
  compact = false,
  className,
}: MaterialGridCardProps) {
  const { t } = useTranslation('procurement');

  const categoryLabel =
    t(`categories.${material.atoeCategoryCode}`, { defaultValue: '' }) ||
    material.atoeCategoryCode;

  const unitLabel =
    t(`hub.materialCatalog.units.${material.unit}`, { defaultValue: '' }) || material.unit;

  const subtitle = `${material.code} · ${unitLabel}`;

  const stats = useMemo<StatItem[]>(() => {
    const items: StatItem[] = [];
    if (material.lastPrice !== null) {
      items.push({
        icon: DollarSign,
        iconColor: 'text-green-600',
        label: t('hub.materialCatalog.lastPrice'),
        value: formatCurrency(material.lastPrice),
      });
    }
    if (material.avgPrice !== null) {
      items.push({
        icon: TrendingUp,
        iconColor: 'text-blue-600',
        label: t('hub.materialCatalog.avgPrice'),
        value: formatCurrency(material.avgPrice),
      });
    }
    if (material.lastPurchaseDate) {
      items.push({
        icon: Calendar,
        iconColor: 'text-amber-600',
        label: t('hub.materialCatalog.detail.lastPurchase'),
        value: formatDate(material.lastPurchaseDate.toDate()),
      });
    }
    return items;
  }, [material, t]);

  const badges = useMemo<GridCardBadge[]>(
    () => [{ label: categoryLabel, variant: 'outline' as GridCardBadgeVariant }],
    [categoryLabel],
  );

  return (
    <GridCard
      customIcon={Layers}
      customIconColor="text-yellow-600"
      title={material.name}
      subtitle={subtitle}
      badges={badges}
      stats={stats}
      isSelected={isSelected}
      onClick={onSelect}
      compact={compact}
      className={className}
      aria-label={t('hub.materialCatalog.cardAriaLabel', {
        name: material.name,
        code: material.code,
      })}
    />
  );
}

MaterialGridCard.displayName = 'MaterialGridCard';

export default MaterialGridCard;
