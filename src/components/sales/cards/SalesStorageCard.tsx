'use client';

/**
 * @fileoverview Sales Storage List Card — ADR-199
 * @description Card for storage units in sales context — extends ListCard molecule
 * @pattern Same as SalesPropertyListCard but with storage-specific data
 */

import { COMMON_NAMESPACES } from '@/i18n/namespace-bundles';
import React, { useMemo } from 'react';
import { DollarSign, Calculator, Layers } from 'lucide-react';
import { ListCard } from '@/design-system/components/ListCard/ListCard';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { NO_PRICE_TOTAL } from '@/lib/listings/listing-price-label';
import { salesCardPricing } from '@/components/sales/shared/sales-space-page';
import { spaceStatusBadges } from '@/lib/units/unit-status-badges';
import type { Storage } from '@/types/storage/contracts';
import '@/lib/design-system';

// =============================================================================
// 🏢 TYPES
// =============================================================================

interface SalesStorageCardProps {
  storage: Storage;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  compact?: boolean;
  className?: string;
}

// =============================================================================
// 🏢 COMPONENT
// =============================================================================

export function SalesStorageCard({
  storage,
  isSelected = false,
  onSelect,
  compact = true,
  className,
}: SalesStorageCardProps) {
  const { t } = useTranslation(COMMON_NAMESPACES);
  // ADR-777 §8.60.20 — ξεχωριστό hook με ρητό namespace (ο CHECK 3.8 τα διαβάζει στατικά· πρότυπο ADR-744).
  const { t: tUnit } = useTranslation('properties-enums');

  // ADR-777 §8.60.20 — διάθεση (από το `commercialStatus`) + λειτουργική εξαίρεση, από το ΕΝΑ SSoT
  // των μονάδων. Ως τις 2026-09-18 διάβαζε το παλιό `status`: θέση πωλημένη μαζί με ακίνητο
  // εμφανιζόταν εδώ «Διαθέσιμη» — στη σελίδα ΠΩΛΗΣΕΩΝ.
  const badges = useMemo(() => spaceStatusBadges(storage, tUnit), [storage, tUnit]);

  // ADR-777 Α6 + §8.60.14.14 — the ONE shared pricing helper, with the UNIT written in.
  const { price, pricePerSqm } = salesCardPricing(storage, t);
  const area = storage.area ?? 0;

  const stats = useMemo(() => {
    const items = [
      {
        icon: Layers,
        iconColor: 'text-primary',
        label: t('storage:general.fields.type'),
        value: t(`storage:types.${storage.type}`, { defaultValue: storage.type }),
      },
      {
        icon: Calculator,
        iconColor: 'text-primary',
        label: t('storage:general.fields.area'),
        value: `${area} m²`,
      },
      {
        icon: DollarSign,
        iconColor: 'text-[hsl(var(--text-success))]',
        label: t('storage:general.fields.price'),
        value: price ?? NO_PRICE_TOTAL,
      },
    ];

    if (pricePerSqm) {
      items.push({
        icon: Calculator,
        iconColor: 'text-primary',
        label: t('storage:general.fields.pricePerSqm'),
        value: pricePerSqm,
      });
    }

    return items;
  }, [t, storage.type, area, price, pricePerSqm]);

  return (
    <ListCard
      title={storage.name || storage.id}
      subtitle={`${storage.building ?? ''} · ${storage.floor ?? ''}`}
      badges={badges}
      stats={stats}
      compact={compact}
      hideIcon
      inlineBadges
      hoverVariant="standard"
      isSelected={isSelected}
      onClick={() => onSelect?.(storage.id)}
      role="option"
      entityType="storage"
      className={className}
    />
  );
}
