'use client';

/**
 * @fileoverview Sales Details Header — ADR-197 §2.9
 * @description Header with 3 commercial action buttons: Change Price, Reserve, Sell
 * @pattern Uses centralized EntityDetailsHeader + createEntityAction
 */

import React, { useMemo } from 'react';
import { ShoppingBag, DollarSign, UserCheck, CheckCircle } from 'lucide-react';
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
}

// =============================================================================
// 🏢 COMPONENT
// =============================================================================

export function SalesDetailsHeader({
  unit,
  onChangePrice,
  onReserve,
  onSell,
}: SalesDetailsHeaderProps) {
  const { t } = useTranslation('common');

  const actions = useMemo<EntityHeaderAction[]>(() => [
    // 1. Αλλαγή τιμής — always visible (sets price + commercialStatus: for-sale)
    createEntityAction(
      'edit',
      t('sales.actions.changePrice', { defaultValue: 'Τιμή' }),
      onChangePrice,
      { icon: DollarSign }
    ),
    // 2. Κράτηση — always visible (sets reserved + buyer)
    createEntityAction(
      'new',
      t('sales.actions.reserve', { defaultValue: 'Κράτηση' }),
      onReserve,
      { icon: UserCheck }
    ),
    // 3. Πώληση — always visible (sets sold + finalPrice + saleDate)
    createEntityAction(
      'save',
      t('sales.actions.sell', { defaultValue: 'Πώληση' }),
      onSell,
      { icon: CheckCircle }
    ),
  ], [t, onChangePrice, onReserve, onSell]);

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
