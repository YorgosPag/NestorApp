'use client';

/**
 * @fileoverview Revert Dialog — ADR-197 §2.9
 * @description Dialog for cancelling a sale/reservation and reverting to "for sale"
 */

import React, { useState, useCallback } from 'react';
import { formatCurrency } from '@/lib/intl-utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Undo2 } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { AppurtenancesSection } from './AppurtenancesSection';
import { useLinkedSpacesForSale } from '@/hooks/sales/useLinkedSpacesForSale';
import { getPrimaryBuyerContactId, formatOwnerNames } from '@/lib/ownership/owner-utils';
import type { PropertyOwnerEntry } from '@/types/ownership-table';
import { createModuleLogger } from '@/lib/telemetry';
import '@/lib/design-system';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { resolveSalesUnitProjectId as resolveProjectId } from './sales-dialog-utils';
import type { BaseDialogProps } from './sales-dialog-utils';
import { useGuardedPropertyMutation } from '@/hooks/useGuardedPropertyMutation';
import { useNotifications } from '@/providers/NotificationProvider';
import { translatePropertyMutationError } from '@/services/property/property-mutation-feedback';
import {
  dispatchSalesAccountingEventWithPolicy,
  syncSalesAppurtenancesWithPolicy,
} from '@/services/sales-mutation-gateway';
import { nowISO } from '@/lib/date-local';

const logger = createModuleLogger('RevertDialog');

export function RevertDialog({ unit, open, onOpenChange, onSuccess }: BaseDialogProps) {
  const colors = useSemanticColors();
  const { t } = useTranslation(['common', 'common-account', 'common-actions', 'common-empty-states', 'common-navigation', 'common-photos', 'common-sales', 'common-shared', 'common-status', 'common-validation']);
  const iconSizes = useIconSizes();
  const { success, error: notifyError } = useNotifications();
  const [saving, setSaving] = useState(false);
  const { checking: previewChecking, runRevertUpdate, ImpactDialog } = useGuardedPropertyMutation(unit);

  const linkedSpaces = useLinkedSpacesForSale(unit);

  const currentStatus = unit.commercialStatus;
  const statusLabel = currentStatus === 'sold'
    ? t('sales.commercialStatus.sold')
    : currentStatus === 'reserved'
      ? t('sales.commercialStatus.reserved')
      : currentStatus ?? '';

  const handleRevert = useCallback(async () => {
    setSaving(true);
    try {
      const depositToRefund = unit.commercial?.reservationDeposit ?? 0;
      const existingOwners = (unit.commercial?.owners as PropertyOwnerEntry[] | null) ?? [];
      const refundBuyerContactId = getPrimaryBuyerContactId(existingOwners);
      const refundBuyerName = formatOwnerNames(existingOwners);

      const updates: Record<string, unknown> = {
        commercialStatus: 'for-sale',
        commercial: {
          askingPrice: unit.commercial?.askingPrice ?? null,
          finalPrice: null,
          reservationDeposit: null,
          owners: null,
          ownerContactIds: null,
          reservationDate: unit.commercial?.reservationDate ?? null,
          saleDate: null,
          listedDate: unit.commercial?.listedDate ?? null,
          cancellationDate: nowISO(),
          transactionChainId: unit.commercial?.transactionChainId ?? null,
        },
      };
      const completed = await runRevertUpdate(
        unit,
        updates,
        (err) => notifyError(translatePropertyMutationError(err, t)),
      );
      if (!completed) {
        return;
      }
      onOpenChange(false);
      onSuccess?.();
      success(t('viewer.messages.updateSuccess', { ns: 'properties' }));

      const wasSold = currentStatus === 'sold';
      const creditAmount = wasSold
        ? (unit.commercial?.finalPrice ?? depositToRefund)
        : depositToRefund;
      const creditReason = wasSold
        ? t('sales.dialogs.revert.creditReasonSale')
        : t('sales.dialogs.revert.creditReasonReservation');

      const propertyName = unit.name ?? unit.propertyName ?? '';
      const lineItems = linkedSpaces.hasSpaces
        ? linkedSpaces.buildLineItems(creditAmount, propertyName)
        : undefined;

      if (creditAmount > 0) {
        dispatchSalesAccountingEventWithPolicy(unit.id, {
          eventType: 'credit_invoice',
          propertyId: unit.id, propertyName,
          projectId: resolveProjectId(unit) ?? null,
          buyerContactId: refundBuyerContactId,
          buyerName: refundBuyerName,
          projectName: null, permitTitle: null, companyName: null,
          buildingName: null, unitFloor: unit.floor ?? null,
          projectAddress: null, paymentMethod: 'bank_transfer', notes: null,
          creditAmount,
          reason: creditReason,
          lineItems,
        }).catch((err: unknown) => {
          logger.warn('Credit invoice failed', { error: err });
        });
      }

      if (linkedSpaces.hasSpaces) {
        const syncPayload = linkedSpaces.buildSyncPayload('revert');
        if (syncPayload.length > 0) {
          syncSalesAppurtenancesWithPolicy(unit.id, {
            action: 'revert',
            spaces: syncPayload,
            owners: null,
            ownerContactIds: null,
          }).catch((err: unknown) => {
            logger.warn('Appurtenance revert sync failed', { error: err });
          });
        }
      }
    } catch (error) {
      notifyError(translatePropertyMutationError(error, t));
    } finally {
      setSaving(false);
    }
  }, [currentStatus, linkedSpaces, notifyError, onOpenChange, onSuccess, runRevertUpdate, success, t, unit]);

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Undo2 className={cn(iconSizes.sm, colors.text.warning)} />
            {t('sales.dialogs.revert.title')}
          </DialogTitle>
          <DialogDescription>
            {t('sales.dialogs.revert.description')}
          </DialogDescription>
        </DialogHeader>

        <section className="space-y-3 py-2">
          <p className="text-sm">
            {t('sales.dialogs.revert.currentStatus')}:{' '}
            <span className="font-semibold">{statusLabel}</span>
          </p>

          {unit.commercial?.owners && (unit.commercial.owners as PropertyOwnerEntry[]).length > 0 && (
            <p className={cn("text-sm", colors.text.muted)}>
              {t('sales.dialogs.revert.buyer')}:{' '}
              <span className="font-medium text-foreground">
                {formatOwnerNames(unit.commercial.owners as PropertyOwnerEntry[]) ?? '—'}
              </span>
            </p>
          )}

          {unit.commercial?.finalPrice && (
            <p className={cn("text-sm", colors.text.muted)}>
              {t('sales.dialogs.revert.finalPrice')}:{' '}
              <span className="font-medium text-foreground">
                {formatCurrency(unit.commercial.finalPrice)}
              </span>
            </p>
          )}

          {linkedSpaces.hasSpaces && (
            <AppurtenancesSection
              spaces={linkedSpaces.spaces}
              unitPrice={unit.commercial?.finalPrice ?? unit.commercial?.reservationDeposit ?? 0}
              totalAppurtenancesPrice={linkedSpaces.totalAppurtenancesPrice}
              onToggle={() => {}}
              onPriceChange={() => {}}
              readOnly
            />
          )}

          <p className={cn("text-xs font-medium", colors.text.warning)}>
            {t('sales.dialogs.revert.warning')}
          </p>
        </section>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving || previewChecking}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleRevert}
            disabled={saving || previewChecking}
            className={cn(colors.bg.warning, "hover:opacity-90 text-white")}
          >
            {saving || previewChecking
              ? t('common.saving')
              : t('sales.dialogs.revert.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    {ImpactDialog}
    </>
  );
}
