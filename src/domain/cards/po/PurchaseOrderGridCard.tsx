'use client';

/**
 * 📦 ENTERPRISE PURCHASE ORDER GRID CARD - Domain Component
 *
 * Domain-specific card for purchase orders in grid/tile views.
 * Extends GridCard with PO-specific defaults: supplier, total, date, status.
 *
 * @fileoverview Purchase Order domain card using centralized GridCard.
 * @see GridCard for base component
 * @see PurchaseOrderListCard for list view equivalent
 * @see PO_STATUS_META for status metadata
 */

import React, { useMemo } from 'react';
import { Package, Building2, DollarSign, Calendar } from 'lucide-react';

import { GridCard } from '@/design-system';
import type { StatItem } from '@/design-system';
import type {
  GridCardBadge,
  GridCardBadgeVariant,
} from '@/design-system/components/GridCard/GridCard.types';

import type { PurchaseOrder, PurchaseOrderStatus } from '@/types/procurement';
import { PO_STATUS_META } from '@/types/procurement';

import { useContactById } from '@/hooks/useContactById';
import { getContactDisplayName } from '@/types/contacts/helpers';
import {
  formatPOCurrency,
  formatPODate,
} from '@/components/procurement/utils/procurement-format';
import { useTranslation } from '@/i18n/hooks/useTranslation';

const STATUS_BADGE_VARIANTS: Record<PurchaseOrderStatus, GridCardBadgeVariant> = {
  draft: 'secondary',
  approved: 'info',
  ordered: 'warning',
  partially_delivered: 'warning',
  delivered: 'success',
  closed: 'success',
  cancelled: 'destructive',
};

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
  const { t, i18n } = useTranslation(['procurement']);
  const contact = useContactById(po.supplierId);

  const supplierName = useMemo(
    () => (contact ? getContactDisplayName(contact) : po.supplierId),
    [contact, po.supplierId],
  );

  const statusMeta = PO_STATUS_META[po.status];
  const lang = (i18n.language?.startsWith('en') ? 'en' : 'el') as 'el' | 'en';

  const stats = useMemo<StatItem[]>(
    () => [
      {
        icon: Building2,
        iconColor: 'text-green-600',
        label: t('detail.supplier'),
        value: supplierName,
      },
      {
        icon: DollarSign,
        iconColor: 'text-emerald-600',
        label: t('detail.total'),
        value: formatPOCurrency(po.total),
      },
      {
        icon: Calendar,
        iconColor: 'text-blue-600',
        label: t('detail.dateCreated'),
        value: formatPODate(po.dateCreated),
      },
    ],
    [supplierName, po.total, po.dateCreated, t],
  );

  const badges = useMemo<GridCardBadge[]>(
    () => [
      {
        label: statusMeta.label[lang],
        variant: STATUS_BADGE_VARIANTS[po.status],
      },
    ],
    [statusMeta.label, lang, po.status],
  );

  return (
    <GridCard
      customIcon={Package}
      customIconColor="text-blue-600"
      title={po.poNumber}
      subtitle={supplierName}
      badges={badges}
      stats={stats}
      isSelected={isSelected}
      onClick={onSelect}
      compact={compact}
      className={className}
      aria-label={t('list.cardAriaLabel', {
        poNumber: po.poNumber,
        supplier: supplierName,
      })}
    />
  );
}

PurchaseOrderGridCard.displayName = 'PurchaseOrderGridCard';

export default PurchaseOrderGridCard;
