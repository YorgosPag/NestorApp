'use client';

/**
 * @fileoverview Reserve Dialog — ADR-197 §2.9
 * @description Dialog for reserving a unit with buyer assignment and deposit
 */

import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { NumericField } from '@/components/ui/numeric-field';
import { UserCheck, UserPlus } from 'lucide-react';
import { TabbedAddNewContactDialog } from '@/components/contacts/dialogs/TabbedAddNewContactDialog';
import { OwnersList } from '@/components/shared/owners/OwnersList';
import { isOwnersValid } from '@/lib/ownership/owner-utils';
import { AppurtenancesSection } from './AppurtenancesSection';
import { useLinkedSpacesForSale } from '@/hooks/sales/useLinkedSpacesForSale';
import { usePaymentPlan } from '@/hooks/usePaymentPlan';
import { createModuleLogger } from '@/lib/telemetry';
import '@/lib/design-system';
import { cn } from '@/lib/utils';
import type { BaseDialogProps } from './sales-dialog-utils';
import { buildSalesAccountingEventBase } from './sales-dialog-payloads';
import { useSalesDialogChrome } from './use-sales-dialog-chrome';
import { useSalesBuyerOwners } from './use-sales-buyer-owners';
import { useSalesActionMutation } from './use-sales-action-mutation';
import { SalesValidationAlert, SalesSaveError, SalesInlineWarning } from './SalesDialogAlerts';
import { dispatchSalesAccountingEventWithPolicy } from '@/services/sales-mutation-gateway';
import { nowISO } from '@/lib/date-local';

const logger = createModuleLogger('ReserveDialog');

export function ReserveDialog({ unit, open, onOpenChange, onSuccess }: BaseDialogProps) {
  const { colors, t, success, notifyError, iconSizes } = useSalesDialogChrome();
  // ADR-706: number model, 0 = "no deposit entered" (rendered blank).
  const [deposit, setDeposit] = useState<number>(0);

  // ADR-244: Multi-buyer owners state
  const { owners, setOwners, buyerContactId, buyerName, buyerHasEmail, hierarchy } =
    useSalesBuyerOwners(unit, open);
  const { planGroup, isLoading: planLoading } = usePaymentPlan(open ? unit.id : null);
  const hasNoPlan = !planLoading && planGroup === 'none';

  const hasAskingPrice = (unit.commercial?.askingPrice ?? 0) > 0;
  const netArea = unit.area ?? 0;
  const grossArea = (unit.areas as Record<string, number> | undefined)?.gross ?? 0;
  const hasArea = netArea > 0 || grossArea > 0;

  const linkedSpaces = useLinkedSpacesForSale(unit);

  const mutation = useSalesActionMutation({
    unit,
    owners,
    linkedSpaces,
    action: 'reserve',
    unknownErrorI18nKey: 'sales.dialogs.reserve.unknownError',
    onOpenChange,
    onSuccess,
    t,
    notifySuccess: success,
    notifyError,
  });

  // Dialog switching: Reserve ↔ NewContact
  const [activeDialog, setActiveDialog] = useState<'reserve' | 'new-contact'>('reserve');

  const handleReserveOpenChange = useCallback((isOpen: boolean) => {
    if (!isOpen) setActiveDialog('reserve');
    onOpenChange(isOpen);
  }, [onOpenChange]);

  const handleOpenNewContact = useCallback(() => setActiveDialog('new-contact'), []);

  const handleNewContactCreated = useCallback(() => setActiveDialog('reserve'), []);

  const handleNewContactCancel = useCallback((isOpen: boolean) => {
    if (!isOpen) setActiveDialog('reserve');
  }, []);

  const handleSave = useCallback(() => mutation.runAction({
    commercialStatus: 'reserved',
    invoicedAmount: deposit,
    commercialChanges: {
      reservationDeposit: deposit || null,
      reservationDate: nowISO(),
      listedDate: unit.commercial?.listedDate ?? nowISO(),
    },
    dispatchEvents: ({ propertyName, lineItems }) => {
      const base = buildSalesAccountingEventBase(unit, {
        propertyName,
        buyerContactId: buyerContactId || null,
        buyerName: buyerName || null,
      });

      if (buyerContactId) {
        dispatchSalesAccountingEventWithPolicy(unit.id, {
          ...base,
          eventType: 'reservation_notify',
          depositAmount: deposit || 0,
        }).catch((err: unknown) => {
          logger.warn('Reservation notify failed', { error: err });
        });
      }

      if (deposit > 0) {
        dispatchSalesAccountingEventWithPolicy(unit.id, {
          ...base,
          eventType: 'deposit_invoice',
          depositAmount: deposit,
          lineItems,
        }).catch((err: unknown) => {
          logger.warn('Deposit invoice failed', { error: err });
        });
      }
    },
  }), [buyerContactId, buyerName, deposit, mutation, unit]);

  const missingFieldKeys = [
    ...(hasAskingPrice ? [] : ['sales.errors.noAskingPrice']),
    ...(hasArea ? [] : ['sales.errors.noArea']),
  ];

  return (
    <>
      <Dialog open={open && activeDialog === 'reserve'} onOpenChange={handleReserveOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className={cn(iconSizes.sm, colors.text.accent)} />
              {t('sales.dialogs.reserve.title')}
            </DialogTitle>
            <DialogDescription>
              {t('sales.dialogs.reserve.description')}
            </DialogDescription>
          </DialogHeader>

          <section className="space-y-3 py-2">
            <OwnersList owners={owners} onChange={setOwners} defaultRole="buyer" disabled={mutation.saving} />
            {buyerContactId && !buyerHasEmail && (
              <SalesInlineWarning i18nKey="sales.dialogs.reserve.noEmailWarning" />
            )}
            {hasNoPlan && (
              <SalesInlineWarning i18nKey="sales.dialogs.reserve.noPaymentPlanWarning" />
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn("gap-1 text-xs", colors.text.muted)}
              onClick={handleOpenNewContact}
            >
              <UserPlus className={iconSizes.xs} />
              {t('sales.dialogs.reserve.newContact')}
            </Button>

            <fieldset className="space-y-1">
              <NumericField
                id="reserve-deposit"
                label={t('sales.dialogs.reserve.deposit')}
                labelClassName="text-sm font-medium"
                min={0}
                step={500}
                value={deposit}
                onValueChange={setDeposit}
                blankValue={0}
                placeholder={t('sales.dialogs.reserve.depositPlaceholder')}
                className="text-right"
              />
            </fieldset>

            {linkedSpaces.hasSpaces && (
              <AppurtenancesSection
                spaces={linkedSpaces.spaces}
                unitPrice={deposit}
                totalAppurtenancesPrice={linkedSpaces.totalAppurtenancesPrice}
                onToggle={linkedSpaces.toggleSpace}
                onPriceChange={linkedSpaces.setSpacePrice}
              />
            )}
          </section>

          <SalesValidationAlert i18nKeys={missingFieldKeys} />
          <SalesValidationAlert i18nKeys={hierarchy.errors.map((err) => err.i18nKey)} />
          <SalesSaveError message={mutation.saveError} />

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.saving}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleSave}
              disabled={mutation.saving || mutation.checking || !isOwnersValid(owners) || !hierarchy.isValid || !hasAskingPrice || !hasArea}
            >
              {mutation.saving
                ? t('common.saving')
                : t('sales.dialogs.reserve.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {mutation.impactDialog}
      <TabbedAddNewContactDialog
        open={open && activeDialog === 'new-contact'}
        onOpenChange={handleNewContactCancel}
        onContactAdded={handleNewContactCreated}
      />
    </>
  );
}
