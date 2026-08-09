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
import { formatCurrencyWhole } from '@/lib/intl-utils';
import { salesSpaceCardPricing, salesSpaceStatusBadge } from '@/components/sales/shared/sales-space-page';
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

  const status = storage.status ?? 'available';

  // Το χρώμα μιας κατάστασης είναι κοινό και για τους δύο χώρους — δες
  // `sales-space-page`. Ήταν γραμμένο δύο φορές και μπορούσε να αποκλίνει.
  const badges = useMemo(
    () => [salesSpaceStatusBadge('storage', status, t)],
    [t, status],
  );

  // ADR-777 Α6 — the ONE shared pricing helper, so this card and the storage
  // detail panel cannot disagree about the same unit.
  const { price, pricePerSqm } = salesSpaceCardPricing(storage);
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
        value: formatCurrencyWhole(price),
      },
    ];

    if (pricePerSqm) {
      items.push({
        icon: Calculator,
        iconColor: 'text-primary',
        label: t('storage:general.fields.pricePerSqm'),
        value: `${formatCurrencyWhole(pricePerSqm)}/m²`,
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
