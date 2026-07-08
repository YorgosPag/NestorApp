'use client';

/**
 * 📦 PURCHASE ORDER CARD — Shared Model (ADR-585)
 *
 * Shared derived data for PurchaseOrderGridCard + PurchaseOrderListCard (Grid =
 * StatItems, List = single-line subtitle + inline badge). Centralizes the
 * supplier-name / status-badge derivation + the `STATUS_BADGE_VARIANTS` map that
 * were duplicated across both views.
 *
 * @see ADR-585 Domain card view-model hook SSoT
 */

import { useMemo } from 'react';

import type { GridCardBadge, GridCardBadgeVariant } from '@/design-system/components/GridCard/GridCard.types';
import { useContactById } from '@/hooks/useContactById';
import { getContactDisplayName } from '@/types/contacts/helpers';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { PurchaseOrder, PurchaseOrderStatus } from '@/types/procurement';
import { PO_STATUS_META } from '@/types/procurement';

/** Status → badge variant (GridCardBadgeVariant ⊂ ListCardBadgeVariant → both shells). */
export const PO_STATUS_BADGE_VARIANTS: Record<PurchaseOrderStatus, GridCardBadgeVariant> = {
  draft: 'secondary',
  approved: 'info',
  ordered: 'warning',
  partially_delivered: 'warning',
  delivered: 'success',
  closed: 'success',
  cancelled: 'destructive',
};

/**
 * Resolve the shared supplier name, status badge, aria label + `t` for a PO.
 */
export function usePurchaseOrderCardCommon(po: PurchaseOrder) {
  const { t, i18n } = useTranslation(['procurement']);
  const contact = useContactById(po.supplierId);

  const supplierName = useMemo(
    () => (contact ? getContactDisplayName(contact) : po.supplierId),
    [contact, po.supplierId],
  );

  const statusMeta = PO_STATUS_META[po.status];
  const lang = (i18n.language?.startsWith('en') ? 'en' : 'el') as 'el' | 'en';

  const badges = useMemo<GridCardBadge[]>(
    () => [{ label: statusMeta.label[lang], variant: PO_STATUS_BADGE_VARIANTS[po.status] }],
    [statusMeta.label, lang, po.status],
  );

  return {
    t,
    supplierName,
    badges,
    ariaLabel: t('list.cardAriaLabel', { poNumber: po.poNumber, supplier: supplierName }),
  };
}
