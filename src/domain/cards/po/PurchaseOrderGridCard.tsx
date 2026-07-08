'use client';

/**
 * 📦 ENTERPRISE PURCHASE ORDER GRID CARD - Domain Component
 *
 * Grid card for purchase orders. Shared supplier/status derivation comes from
 * usePurchaseOrderCardCommon (ADR-585); this wrapper owns the Grid StatItems.
 *
 * @fileoverview Purchase Order domain card using centralized GridCard.
 * @see GridCard for base component
 * @see PurchaseOrderListCard for list view equivalent
 * @see usePurchaseOrderCardCommon for the shared model (ADR-585)
 */

import React, { useMemo } from 'react';
import { Package, Building2, DollarSign, Calendar } from 'lucide-react';

import { GridCard } from '@/design-system';
import type { StatItem } from '@/design-system';

import type { PurchaseOrder } from '@/types/procurement';
import {
  formatPOCurrency,
  formatPODate,
} from '@/components/procurement/utils/procurement-format';

import { usePurchaseOrderCardCommon } from './po-card-model';

export interface PurchaseOrderGridCardProps {
  po: PurchaseOrder;
  isSelected?: boolean;
  onSelect?: () => void;
  compact?: boolean;
  className?: string;
}

export function PurchaseOrderGridCard({
  po,
  isSelected = false,
  onSelect,
  compact = false,
  className,
}: PurchaseOrderGridCardProps) {
  const { t, supplierName, badges, ariaLabel } = usePurchaseOrderCardCommon(po);

  const stats = useMemo<StatItem[]>(
    () => [
      {
        icon: Building2,
        iconColor: 'text-[hsl(var(--text-success))]',
        label: t('detail.supplier'),
        value: supplierName,
      },
      {
        icon: DollarSign,
        iconColor: 'text-[hsl(var(--text-success))]',
        label: t('detail.total'),
        value: formatPOCurrency(po.total),
      },
      {
        icon: Calendar,
        iconColor: 'text-primary',
        label: t('detail.dateCreated'),
        value: formatPODate(po.dateCreated),
      },
    ],
    [supplierName, po.total, po.dateCreated, t],
  );

  return (
    <GridCard
      customIcon={Package}
      customIconColor="text-primary"
      title={po.poNumber}
      subtitle={supplierName}
      badges={badges}
      stats={stats}
      isSelected={isSelected}
      onClick={onSelect}
      compact={compact}
      className={className}
      aria-label={ariaLabel}
    />
  );
}

PurchaseOrderGridCard.displayName = 'PurchaseOrderGridCard';

export default PurchaseOrderGridCard;
