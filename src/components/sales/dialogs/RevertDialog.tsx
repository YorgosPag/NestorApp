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
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import { AppurtenancesSection } from './AppurtenancesSection';
import { useLinkedSpacesForSale } from '@/hooks/sales/useLinkedSpacesForSale';
import { createModuleLogger } from '@/lib/telemetry';
import '@/lib/design-system';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { resolveProjectId } from './sales-dialog-utils';
import type { BaseDialogProps } from './sales-dialog-utils';

const logger = createModuleLogger('RevertDialog');

export function RevertDialog({ unit, open, onOpenChange, onSuccess }: BaseDialogProps) {
  const colors = useSemanticColors();
  const { t } = useTranslation('common');
  const iconSizes = useIconSizes();
  const [saving, setSaving] = useState(false);

  const linkedSpaces = useLinkedSpacesForSale(unit);

  const currentStatus = unit.commercialStatus;
  const statusLabel = currentStatus === 'sold'
    ? t('sales.commercialStatus.sold', { defaultValue: 'Πωλήθηκε' })
    : currentStatus === 'reserved'
      ? t('sales.commercialStatus.reserved', { defaultValue: 'Κρατημένη' })
      : currentStatus ?? '';

  const handleRevert = useCallback(async () => {
    setSaving(true);
    try {
      const depositToRefund = unit.commercial?.reservationDeposit ?? 0;
      const refundBuyerContactId = unit.commercial?.buyerContactId ?? null;

      await apiClient.patch(API_ROUTES.UNITS.BY_ID(unit.id), {
        commercialStatus: 'for-sale',
        commercial: {
          askingPrice: unit.commercial?.askingPrice ?? null,
          finalPrice: null,
          reservationDeposit: null,
          buyerContactId: null,
          buyerName: null,
          reservationDate: unit.commercial?.reservationDate ?? null,
          saleDate: null,
          listedDate: unit.commercial?.listedDate ?? null,
          cancellationDate: new Date().toISOString(),
          transactionChainId: unit.commercial?.transactionChainId ?? null,
        },
      } as Record<string, unknown>);
      onOpenChange(false);
      onSuccess?.();

      const wasSold = currentStatus === 'sold';
      const creditAmount = wasSold
        ? (unit.commercial?.finalPrice ?? depositToRefund)
        : depositToRefund;
      const creditReason = wasSold
        ? t('sales.dialogs.revert.creditReasonSale', { defaultValue: 'Ακύρωση πώλησης' })
        : t('sales.dialogs.revert.creditReasonReservation', { defaultValue: 'Ακύρωση κράτησης' });

      const unitName = unit.name ?? unit.unitName ?? '';
      const lineItems = linkedSpaces.hasSpaces
        ? linkedSpaces.buildLineItems(creditAmount, unitName)
        : undefined;

      if (creditAmount > 0) {
        apiClient.post(API_ROUTES.SALES.ACCOUNTING_EVENT(unit.id), {
          eventType: 'credit_invoice',
          unitId: unit.id, unitName,
          projectId: resolveProjectId(unit) ?? null,
          buyerContactId: refundBuyerContactId,
          buyerName: unit.commercial?.buyerName ?? null,
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
          apiClient.post(API_ROUTES.SALES.APPURTENANCE_SYNC(unit.id), {
            action: 'revert',
            spaces: syncPayload,
            buyerContactId: null,
            buyerName: null,
          }).catch((err: unknown) => {
            logger.warn('Appurtenance revert sync failed', { error: err });
          });
        }
      }
    } catch {
      // Error handled by service
    } finally {
      setSaving(false);
    }
  }, [unit, onOpenChange, onSuccess, linkedSpaces, currentStatus, t]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Undo2 className={cn(iconSizes.sm, colors.text.warning)} />
            {t('sales.dialogs.revert.title', { defaultValue: 'Επαναφορά Μονάδας' })}
          </DialogTitle>
          <DialogDescription>
            {t('sales.dialogs.revert.description', {
              defaultValue: 'Ακύρωση πώλησης ή κράτησης — η μονάδα επιστρέφει σε κατάσταση «Προς Πώληση»',
            })}
          </DialogDescription>
        </DialogHeader>

        <section className="space-y-3 py-2">
          <p className="text-sm">
            {t('sales.dialogs.revert.currentStatus', { defaultValue: 'Τρέχουσα κατάσταση' })}:{' '}
            <span className="font-semibold">{statusLabel}</span>
          </p>

          {unit.commercial?.buyerContactId && (
            <p className={cn("text-sm", colors.text.muted)}>
              {t('sales.dialogs.revert.buyer', { defaultValue: 'Αγοραστής' })}:{' '}
              <span className="font-medium text-foreground">{unit.commercial.buyerContactId}</span>
            </p>
          )}

          {unit.commercial?.finalPrice && (
            <p className={cn("text-sm", colors.text.muted)}>
              {t('sales.dialogs.revert.finalPrice', { defaultValue: 'Τιμή πώλησης' })}:{' '}
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
            {t('sales.dialogs.revert.warning', {
              defaultValue: 'Τα στοιχεία αγοραστή, προκαταβολής και τελικής τιμής θα διαγραφούν. Η ζητούμενη τιμή διατηρείται.',
            })}
          </p>
        </section>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t('common.cancel', { defaultValue: 'Ακύρωση' })}
          </Button>
          <Button
            onClick={handleRevert}
            disabled={saving}
            className={cn(colors.bg.warning, "hover:opacity-90 text-white")}
          >
            {saving
              ? t('common.saving', { defaultValue: 'Αποθήκευση...' })
              : t('sales.dialogs.revert.confirm', { defaultValue: 'Επαναφορά σε Προς Πώληση' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
