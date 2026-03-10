'use client';

/**
 * @fileoverview Sales Details Header — ADR-197
 * @description Header for sales details panel with commercial actions
 * @pattern Uses centralized EntityDetailsHeader + createEntityAction
 */

import React, { useMemo } from 'react';
import { ShoppingBag } from 'lucide-react';
import { EntityDetailsHeader, createEntityAction } from '@/core/entity-headers';
import type { EntityHeaderAction } from '@/core/entity-headers';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { Unit, CommercialStatus } from '@/types/unit';

// =============================================================================
// 🏢 TYPES
// =============================================================================

interface SalesDetailsHeaderProps {
  unit: Unit;
  onChangePrice?: () => void;
  onReserve?: () => void;
  onSell?: () => void;
  onCancelReservation?: () => void;
  onWithdraw?: () => void;
  onRelist?: () => void;
  onSwitchToRent?: () => void;
}

// =============================================================================
// 🏢 ACTION VISIBILITY RULES (ADR-197 §2.9)
// =============================================================================

function getVisibleActions(
  status: CommercialStatus,
  t: (key: string, options?: Record<string, string>) => string,
  handlers: SalesDetailsHeaderProps,
): EntityHeaderAction[] {
  const actions: EntityHeaderAction[] = [];

  const forSaleStatuses: CommercialStatus[] = ['for-sale', 'for-sale-and-rent', 'for-rent'];
  const sellableStatuses: CommercialStatus[] = ['for-sale', 'for-sale-and-rent', 'reserved'];

  // 1. Αλλαγή τιμής — visible when on market
  if (forSaleStatuses.includes(status) && handlers.onChangePrice) {
    actions.push(
      createEntityAction('edit', t('sales.actions.changePrice', { defaultValue: 'Αλλαγή τιμής' }), handlers.onChangePrice)
    );
  }

  // 2. Κράτηση — visible when for-sale
  if ((status === 'for-sale' || status === 'for-sale-and-rent') && handlers.onReserve) {
    actions.push(
      createEntityAction('new', t('sales.actions.reserve', { defaultValue: 'Κράτηση' }), handlers.onReserve)
    );
  }

  // 3. Πώληση — visible when sellable
  if (sellableStatuses.includes(status) && handlers.onSell) {
    actions.push(
      createEntityAction('save', t('sales.actions.sell', { defaultValue: 'Πώληση' }), handlers.onSell)
    );
  }

  // 4. Ακύρωση κράτησης — visible when reserved
  if (status === 'reserved' && handlers.onCancelReservation) {
    actions.push(
      createEntityAction('cancel', t('sales.actions.cancelReservation', { defaultValue: 'Ακύρωση κράτησης' }), handlers.onCancelReservation)
    );
  }

  // 5. Απόσυρση — visible when on market
  if (forSaleStatuses.includes(status) && handlers.onWithdraw) {
    actions.push(
      createEntityAction('cancel', t('sales.actions.withdraw', { defaultValue: 'Απόσυρση' }), handlers.onWithdraw)
    );
  }

  // 6. Επαναφορά — visible when unavailable
  if (status === 'unavailable' && handlers.onRelist) {
    actions.push(
      createEntityAction('edit', t('sales.actions.relist', { defaultValue: 'Επαναφορά' }), handlers.onRelist)
    );
  }

  // 7. Αλλαγή σε ενοικίαση — visible when for-sale
  if ((status === 'for-sale' || status === 'for-sale-and-rent') && handlers.onSwitchToRent) {
    actions.push(
      createEntityAction('view', t('sales.actions.switchToRent', { defaultValue: 'Προς ενοικίαση' }), handlers.onSwitchToRent)
    );
  }

  return actions;
}

// =============================================================================
// 🏢 COMPONENT
// =============================================================================

export function SalesDetailsHeader(props: SalesDetailsHeaderProps) {
  const { unit } = props;
  const { t } = useTranslation('common');

  const commercialStatus = unit.commercialStatus ?? 'unavailable';
  const actions = useMemo(
    () => getVisibleActions(commercialStatus, t, props),
    [commercialStatus, t, props]
  );

  return (
    <EntityDetailsHeader
      icon={ShoppingBag}
      title={unit.name || unit.code || unit.id}
      subtitle={t(`sales.unitTypes.${unit.type}`, { defaultValue: unit.type })}
      variant="detailed"
      actions={actions}
    />
  );
}
