'use client';

/**
 * @fileoverview Sales Details Header — ADR-197 §2.9
 * @description Header with 3 commercial action buttons: Change Price, Reserve, Sell
 * @pattern Uses centralized EntityDetailsHeader + createEntityAction
 */

import React, { useMemo } from 'react';
import { ShoppingBag, DollarSign, UserCheck, CheckCircle, Undo2 } from 'lucide-react';
import { EntityDetailsHeader, createEntityAction } from '@/core/entity-headers';
import type { EntityHeaderAction } from '@/core/entity-headers';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { Property } from '@/types/property';

// =============================================================================
// 🏢 TYPES
// =============================================================================

interface SalesDetailsHeaderProps {
  unit: Property;
  onChangePrice: () => void;
  onReserve: () => void;
  onSell: () => void;
  onRevert: () => void;
}

// =============================================================================
// 🏢 COMPONENT
// =============================================================================

export function SalesDetailsHeader({
  unit,
  onChangePrice,
  onReserve,
  onSell,
  onRevert,
}: SalesDetailsHeaderProps) {
  const { t } = useTranslation('common');

  const status = unit.commercialStatus;
  const isReserved = status === 'reserved';
  const isSold = status === 'sold';
  const canReserve = !isReserved && !isSold;
  const canRevert = isSold || isReserved;

  const actions = useMemo<EntityHeaderAction[]>(() => {
    const list: EntityHeaderAction[] = [
      // 1. Αλλαγή τιμής — μόνο αν δεν είναι πουλημένο
      ...(!isSold ? [createEntityAction(
        'edit',
        t('sales.actions.changePrice'),
        onChangePrice,
        { icon: DollarSign }
      )] : []),
      // 2. Κράτηση — μόνο αν δεν είναι ήδη κρατημένο ή πουλημένο
      ...(canReserve ? [createEntityAction(
        'new',
        t('sales.actions.reserve'),
        onReserve,
        { icon: UserCheck }
      )] : []),
      // 3. Πώληση — μόνο αν είναι διαθέσιμο ή κρατημένο (όχι αν είναι ήδη πουλημένο)
      ...(!isSold ? [createEntityAction(
        'save',
        t('sales.actions.sell'),
        onSell,
        { icon: CheckCircle }
      )] : []),
    ];

    // 4. Επαναφορά — μόνο αν είναι κρατημένο ή πουλημένο
    if (canRevert) {
      list.push(
        createEntityAction(
          'delete',
          t('sales.actions.revert'),
          onRevert,
          { icon: Undo2 }
        ),
      );
    }

    return list;
  }, [t, onChangePrice, onReserve, onSell, onRevert, canReserve, isSold, canRevert]);

  return (
    <EntityDetailsHeader
      icon={ShoppingBag}
      title={unit.name || unit.code || unit.id}
      subtitle={[unit.code, t(`units:types.${unit.type}`)].filter(Boolean).join(' · ')}
      variant="detailed"
      actions={actions}
    />
  );
}
