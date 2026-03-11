'use client';

/**
 * @fileoverview Sales Storage List Card — ADR-199
 * @description Card for storage units in sales context — extends ListCard molecule
 * @pattern Same as SalesUnitListCard but with storage-specific data
 */

import React, { useMemo } from 'react';
import { DollarSign, Calculator, Layers } from 'lucide-react';
import { ListCard } from '@/design-system/components/ListCard/ListCard';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { Storage } from '@/types/storage/contracts';

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
// 🏢 STATUS → BADGE VARIANT MAPPING
// =============================================================================

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info';

const STATUS_BADGE: Record<string, { variant: BadgeVariant; labelKey: string }> = {
  available:   { variant: 'success',     labelKey: 'storage:status.available' },
  occupied:    { variant: 'info',        labelKey: 'storage:status.occupied' },
  reserved:    { variant: 'warning',     labelKey: 'storage:status.reserved' },
  sold:        { variant: 'destructive', labelKey: 'storage:status.sold' },
  maintenance: { variant: 'secondary',   labelKey: 'storage:status.maintenance' },
  unavailable: { variant: 'default',     labelKey: 'storage:status.unavailable' },
};

// =============================================================================
// 🏢 HELPERS
// =============================================================================

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('el-GR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
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
  const { t } = useTranslation('common');

  const status = storage.status ?? 'available';
  const badgeConfig = STATUS_BADGE[status] ?? STATUS_BADGE.available;

  const badges = useMemo(() => [{
    label: t(badgeConfig.labelKey, { defaultValue: status }),
    variant: badgeConfig.variant,
  }], [t, badgeConfig, status]);

  const price = storage.commercial?.askingPrice ?? storage.price ?? 0;
  const area = storage.area ?? 0;
  const pricePerSqm = price > 0 && area > 0 ? Math.round(price / area) : null;

  const stats = useMemo(() => {
    const items = [
      {
        icon: Layers,
        iconColor: 'text-teal-600',
        label: t('storage:general.fields.type', { defaultValue: 'Τύπος' }),
        value: t(`storage:types.${storage.type}`, { defaultValue: storage.type }),
      },
      {
        icon: Calculator,
        iconColor: 'text-pink-600',
        label: t('storage:general.fields.area', { defaultValue: 'Εμβαδόν' }),
        value: `${area} m²`,
      },
      {
        icon: DollarSign,
        iconColor: 'text-green-600',
        label: t('storage:general.fields.price', { defaultValue: 'Τιμή' }),
        value: formatCurrency(price > 0 ? price : null),
      },
    ];

    if (pricePerSqm) {
      items.push({
        icon: Calculator,
        iconColor: 'text-blue-600',
        label: t('storage:general.fields.pricePerSqm', { defaultValue: '€/m²' }),
        value: `${formatCurrency(pricePerSqm)}/m²`,
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
