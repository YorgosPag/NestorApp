'use client';

/**
 * 📦 ENTERPRISE PURCHASE ORDER LIST CARD - Domain Component
 *
 * List card for purchase orders; single-line truncated subtitle
 * "Supplier · Total · Date" + inline status badge. Shared supplier/status
 * derivation comes from usePurchaseOrderCardCommon (ADR-585).
 *
 * @fileoverview Purchase Order domain card using centralized ListCard.
 * @see ListCard for base component
 * @see usePurchaseOrderCardCommon for the shared model (ADR-585)
 */

import React, { useMemo } from 'react';
import { Package } from 'lucide-react';

import { ListCard } from '@/design-system';

import type { PurchaseOrder } from '@/types/procurement';
import { formatPOCurrency, formatPODate } from '@/components/procurement/utils/procurement-format';

import { usePurchaseOrderCardCommon } from './po-card-model';

export interface PurchaseOrderListCardProps {
  po: PurchaseOrder;
  isSelected?: boolean;
  onSelect?: () => void;
  className?: string;
}

export function PurchaseOrderListCard({
  po,
  isSelected = false,
  onSelect,
  className,
}: PurchaseOrderListCardProps) {
  const { supplierName, badges, ariaLabel } = usePurchaseOrderCardCommon(po);

  // 🏢 ENTERPRISE: Single-line subtitle "Supplier · Total · Date" — ListCard truncates
  const subtitle = useMemo(
    () => [
      supplierName,
      formatPOCurrency(po.total),
      formatPODate(po.dateCreated),
    ].filter(Boolean).join(' · '),
    [supplierName, po.total, po.dateCreated],
  );

  return (
    <ListCard
      customIcon={Package}
      customIconColor="text-primary"
      title={po.poNumber}
      subtitle={subtitle}
      badges={badges}
      inlineBadges
      isSelected={isSelected}
      onClick={onSelect}
      className={className}
      aria-label={ariaLabel}
    />
  );
}

PurchaseOrderListCard.displayName = 'PurchaseOrderListCard';

export default PurchaseOrderListCard;
