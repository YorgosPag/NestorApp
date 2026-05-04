'use client';

/**
 * 🏢 ENTERPRISE MATERIAL LIST CARD - Domain Component
 *
 * Domain-specific card for materials in list views.
 * Extends ListCard with material-specific defaults; single-line truncated subtitle
 * "Code · Category · LastPrice" + inline category badge.
 *
 * @fileoverview Material domain card using centralized ListCard.
 * @see ListCard for base component
 */

import React, { useMemo } from 'react';
import { Layers } from 'lucide-react';

import { ListCard } from '@/design-system';
import type {
  ListCardBadge,
  ListCardBadgeVariant,
} from '@/design-system/components/ListCard/ListCard.types';

import { formatCurrency } from '@/lib/intl-formatting';
import { useTranslation } from '@/i18n/hooks/useTranslation';

import type { Material } from '@/subapps/procurement/types/material';

export interface MaterialListCardProps {
  material: Material;
  isSelected?: boolean;
  onSelect?: () => void;
  className?: string;
}

export function MaterialListCard({
  material,
  isSelected = false,
  onSelect,
  className,
}: MaterialListCardProps) {
  const { t } = useTranslation('procurement');

  const categoryLabel =
    t(`categories.${material.atoeCategoryCode}`, { defaultValue: '' }) ||
    material.atoeCategoryCode;

  const badges: ListCardBadge[] = useMemo(
    () => [{ label: categoryLabel, variant: 'outline' as ListCardBadgeVariant }],
    [categoryLabel],
  );

  const subtitle = useMemo(() => {
    const parts = [material.code];
    if (material.lastPrice !== null) {
      parts.push(formatCurrency(material.lastPrice));
    }
    return parts.join(' · ');
  }, [material.code, material.lastPrice]);

  return (
    <ListCard
      customIcon={Layers}
      customIconColor="text-yellow-600"
      title={material.name}
      subtitle={subtitle}
      badges={badges}
      inlineBadges
      isSelected={isSelected}
      onClick={onSelect}
      className={className}
      aria-label={t('hub.materialCatalog.cardAriaLabel', {
        name: material.name,
        code: material.code,
      })}
    />
  );
}

MaterialListCard.displayName = 'MaterialListCard';

export default MaterialListCard;
