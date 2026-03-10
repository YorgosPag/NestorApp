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
import type { Unit } from '@/types/unit';

// =============================================================================
// 🏢 TYPES
// =============================================================================

interface SalesDetailsHeaderProps {
  unit: Unit;
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

  const canRevert = unit.commercialStatus === 'sold' || unit.commercialStatus === 'reserved';

  const actions = useMemo<EntityHeaderAction[]>(() => {
    const list: EntityHeaderAction[] = [
      // 1. Αλλαγή τιμής — always visible
      createEntityAction(
        'edit',
        t('sales.actions.changePrice', { defaultValue: 'Τιμή' }),
        onChangePrice,
        { icon: DollarSign }
      ),
      // 2. Κράτηση — always visible
      createEntityAction(
        'new',
        t('sales.actions.reserve', { defaultValue: 'Κράτηση' }),
        onReserve,
        { icon: UserCheck }
      ),
      // 3. Πώληση — always visible
      createEntityAction(
        'save',
        t('sales.actions.sell', { defaultValue: 'Πώληση' }),
        onSell,
        { icon: CheckCircle }
      ),
    ];

    // 4. Επαναφορά — only when sold or reserved
    if (canRevert) {
      list.push(
        createEntityAction(
          'delete',
          t('sales.actions.revert', { defaultValue: 'Επαναφορά' }),
          onRevert,
          { icon: Undo2 }
        ),
      );
    }

    return list;
  }, [t, onChangePrice, onReserve, onSell, onRevert, canRevert]);

  return (
    <EntityDetailsHeader
      icon={ShoppingBag}
      title={unit.name || unit.code || unit.id}
      subtitle={[unit.code, t(`sales.unitTypes.${unit.type}`, { defaultValue: unit.type })].filter(Boolean).join(' · ')}
      variant="detailed"
      actions={actions}
    />
  );
}
