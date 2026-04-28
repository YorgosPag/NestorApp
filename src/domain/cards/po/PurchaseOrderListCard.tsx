'use client';

/**
 * 📦 ENTERPRISE PURCHASE ORDER LIST CARD - Domain Component
 *
 * Domain-specific card for purchase orders in list views.
 * Extends ListCard with PO-specific defaults; single-line truncated subtitle
 * "Supplier · Total · Date" + inline status badge next to PO#.
 *
 * @fileoverview Purchase Order domain card using centralized ListCard.
 * @enterprise Fortune 500 compliant - ZERO hardcoded values
 * @see ListCard for base component
 * @see PO_STATUS_META for status metadata
 */

import React, { useMemo } from 'react';
import { Package } from 'lucide-react';

// 🏢 DESIGN SYSTEM
import { ListCard } from '@/design-system';
import type { ListCardBadge, ListCardBadgeVariant } from '@/design-system/components/ListCard/ListCard.types';

// 🏢 DOMAIN TYPES
import type { PurchaseOrder, PurchaseOrderStatus } from '@/types/procurement';
import { PO_STATUS_META } from '@/types/procurement';

// 🏢 SHARED HOOKS / FORMATTERS
import { useContactById } from '@/hooks/useContactById';
import { getContactDisplayName } from '@/types/contacts/helpers';
import { formatPOCurrency, formatPODate } from '@/components/procurement/utils/procurement-format';

// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

// =============================================================================
// 🏢 TYPES
// =============================================================================

export interface PurchaseOrderListCardProps {
  po: PurchaseOrder;
  isSelected?: boolean;
  onSelect?: () => void;
  className?: string;
}

// =============================================================================
// 🏢 STATUS COLOR → BADGE VARIANT MAPPING
// =============================================================================

const STATUS_BADGE_VARIANTS: Record<PurchaseOrderStatus, ListCardBadgeVariant> = {
  draft: 'secondary',
  approved: 'info',
  ordered: 'warning',
  partially_delivered: 'warning',
  delivered: 'success',
  closed: 'success',
  cancelled: 'destructive',
};

// =============================================================================
// 🏢 COMPONENT
// =============================================================================

export function PurchaseOrderListCard({
  po,
  isSelected = false,
  onSelect,
  className,
}: PurchaseOrderListCardProps) {
  const { t, i18n } = useTranslation(['procurement']);
  const contact = useContactById(po.supplierId);

  const supplierName = useMemo(
    () => (contact ? getContactDisplayName(contact) : po.supplierId),
    [contact, po.supplierId],
  );

  const statusMeta = PO_STATUS_META[po.status];
  const lang = (i18n.language?.startsWith('en') ? 'en' : 'el') as 'el' | 'en';

  // 🏢 ENTERPRISE: Single-line subtitle "Supplier · Total · Date" — ListCard truncates
  const subtitle = useMemo(
    () => [
      supplierName,
      formatPOCurrency(po.total),
      formatPODate(po.dateCreated),
    ].filter(Boolean).join(' · '),
    [supplierName, po.total, po.dateCreated],
  );

  const badges: ListCardBadge[] = useMemo(
    () => [
      {
        label: statusMeta.label[lang],
        variant: STATUS_BADGE_VARIANTS[po.status],
      },
    ],
    [statusMeta.label, lang, po.status],
  );

  return (
    <ListCard
      customIcon={Package}
      customIconColor="text-blue-600"
      title={po.poNumber}
      subtitle={subtitle}
      badges={badges}
      inlineBadges
      isSelected={isSelected}
      onClick={onSelect}
      className={className}
      aria-label={t('list.cardAriaLabel', { poNumber: po.poNumber, supplier: supplierName })}
    />
  );
}

PurchaseOrderListCard.displayName = 'PurchaseOrderListCard';

export default PurchaseOrderListCard;
