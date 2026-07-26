'use client';

/**
 * @fileoverview Sell Dialog — ADR-197 §2.9
 * @description Dialog for confirming a unit sale with final price and broker selection
 */

import React, { useState, useCallback, useEffect } from 'react';
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
import { Label } from '@/components/ui/label';
import { NumericField } from '@/components/ui/numeric-field';
import { CheckCircle } from 'lucide-react';
import { OwnersList } from '@/components/shared/owners/OwnersList';
import { isOwnersValid } from '@/lib/ownership/owner-utils';
import { AppurtenancesSection } from './AppurtenancesSection';
import type { PropertyOwnerEntry } from '@/types/ownership-table';
import { useLinkedSpacesForSale } from '@/hooks/sales/useLinkedSpacesForSale';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BrokerageService } from '@/services/brokerage.service';
import { useCompanyId } from '@/hooks/useCompanyId';
import { calculateCommission } from '@/types/brokerage';
import type { BrokerageAgreement } from '@/types/brokerage';
import { createModuleLogger } from '@/lib/telemetry';
import '@/lib/design-system';
import { cn } from '@/lib/utils';
import { resolveSalesUnitProjectId as resolveProjectId } from './sales-dialog-utils';
import type { BaseDialogProps } from './sales-dialog-utils';
import { buildSalesAccountingEventBase } from './sales-dialog-payloads';
import { useSalesDialogChrome } from './use-sales-dialog-chrome';
import { useSalesBuyerOwners } from './use-sales-buyer-owners';
import { useSalesActionMutation } from './use-sales-action-mutation';
import { SalesValidationAlert, SalesSaveError, SalesInlineWarning } from './SalesDialogAlerts';
import { dispatchSalesAccountingEventWithPolicy } from '@/services/sales-mutation-gateway';
import { nowISO } from '@/lib/date-local';

const logger = createModuleLogger('SellDialog');

export function SellDialog({ unit, open, onOpenChange, onSuccess }: BaseDialogProps) {
  const { colors, t, success, notifyError, iconSizes } = useSalesDialogChrome();
  // ADR-706: number model, 0 = "no price entered" (rendered blank).
  const [finalPrice, setFinalPrice] = useState<number>(unit.commercial?.askingPrice ?? 0);

  const {
    owners, setOwners, buyerContactId, buyerName,
    buyerHasEmail, hasExistingOwners, hierarchy,
  } = useSalesBuyerOwners(unit, open, { seedFromUnit: true });

  const sellNetArea = unit.area ?? 0;
  const sellGrossArea = (unit.areas as Record<string, number> | undefined)?.gross ?? 0;
  const sellHasArea = sellNetArea > 0 || sellGrossArea > 0;

  const linkedSpaces = useLinkedSpacesForSale(unit);
  const companyId = useCompanyId()?.companyId;
  const [brokerAgreements, setBrokerAgreements] = useState<BrokerageAgreement[]>([]);
  const [selectedBrokerId, setSelectedBrokerId] = useState<string>('none');

  const mutation = useSalesActionMutation({
    unit,
    owners,
    linkedSpaces,
    action: 'sell',
    unknownErrorI18nKey: 'sales.dialogs.sell.unknownError',
    onOpenChange,
    onSuccess,
    t,
    notifySuccess: success,
    notifyError,
  });

  useEffect(() => {
    if (open) {
      setFinalPrice(unit.commercial?.askingPrice ?? 0);
      setSelectedBrokerId('none');

      const propertyOwners = (unit.commercial?.owners as PropertyOwnerEntry[] | null | undefined) ?? null;
      if (propertyOwners && propertyOwners.length > 0) {
        setOwners(propertyOwners);
      } else {
        setOwners([]);
      }

      if (companyId) {
        BrokerageService.getAgreements(resolveProjectId(unit) ?? '', companyId, unit.id, 'active')
          .then(setBrokerAgreements)
          .catch(() => setBrokerAgreements([]));
      } else {
        setBrokerAgreements([]);
      }
    }
  }, [open, companyId, unit.commercial?.askingPrice, unit.commercial?.owners, unit.project, unit.id]);

  /** Καταγραφή προμήθειας μεσίτη — τρέχει μόνο αν επιλέχθηκε συμφωνητικό. */
  const recordBrokerCommission = useCallback((price: number) => {
    if (selectedBrokerId === 'none') return;
    const agreement = brokerAgreements.find((a) => a.id === selectedBrokerId);
    if (!agreement) return;

    BrokerageService.recordCommission(
      {
        brokerageAgreementId: agreement.id,
        agentContactId: agreement.agentContactId,
        agentName: agreement.agentName,
        propertyId: unit.id,
        projectId: resolveProjectId(unit) ?? '',
        primaryBuyerContactId: buyerContactId || '',
        salePrice: price,
        commissionType: agreement.commissionType,
        commissionPercentage: agreement.commissionPercentage,
        commissionFixedAmount: agreement.commissionFixedAmount,
      },
      'system'
    ).catch((err: unknown) => {
      logger.warn('Commission recording failed', { error: err });
    });
  }, [brokerAgreements, buyerContactId, selectedBrokerId, unit]);

  const handleSave = useCallback(() => {
    const price = finalPrice;
    if (price <= 0 || !buyerContactId) return;

    return mutation.runAction({
      commercialStatus: 'sold',
      invoicedAmount: price,
      commercialChanges: {
        finalPrice: price,
        saleDate: nowISO(),
      },
      dispatchEvents: ({ propertyName, lineItems }) => {
        dispatchSalesAccountingEventWithPolicy(unit.id, {
          ...buildSalesAccountingEventBase(unit, {
            propertyName,
            buyerContactId: buyerContactId || null,
            buyerName: buyerName || null,
          }),
          eventType: 'final_sale_invoice',
          finalPrice: price,
          depositAlreadyInvoiced: unit.commercial?.reservationDeposit ?? 0,
          lineItems,
        }).catch((err: unknown) => {
          logger.warn('Final sale invoice failed', { error: err });
        });

        recordBrokerCommission(price);
      },
    });
  }, [buyerContactId, buyerName, finalPrice, mutation, recordBrokerCommission, unit]);

  const askingPrice = unit.commercial?.askingPrice;
  const discount = askingPrice && finalPrice > 0
    ? ((askingPrice - finalPrice) / askingPrice * 100).toFixed(1)
    : null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className={cn(iconSizes.sm, colors.text.success)} />
            {t('sales.dialogs.sell.title')}
          </DialogTitle>
          <DialogDescription>
            {t('sales.dialogs.sell.description')}
          </DialogDescription>
        </DialogHeader>

        <section className="space-y-3 py-2">
          <OwnersList owners={owners} onChange={setOwners} defaultRole="buyer" disabled={mutation.saving} readOnly={hasExistingOwners} />
          {!hasExistingOwners && buyerContactId && !buyerHasEmail && (
            <SalesInlineWarning i18nKey="sales.dialogs.reserve.noEmailWarning" />
          )}

          {askingPrice && (
            <p className={cn("text-sm", colors.text.muted)}>
              {t('sales.dialogs.sell.askingWas')}:{' '}
              <span className="font-medium text-foreground">{formatCurrency(askingPrice)}</span>
            </p>
          )}

          <NumericField
            id="sell-final-price"
            label={t('sales.dialogs.sell.finalPrice')}
            labelClassName="text-sm font-medium"
            min={0} step={1000}
            value={finalPrice}
            onValueChange={setFinalPrice}
            blankValue={0}
            placeholder={t('sales.dialogs.sell.finalPricePlaceholder')}
            className="text-right" autoFocus
          />

          {discount && Number(discount) > 0 && (
            <p className={cn("text-xs", colors.text.warning)}>
              {t('sales.dialogs.sell.discount')}: −{discount}%
            </p>
          )}

          {brokerAgreements.length > 0 && (
            <fieldset className="space-y-1">
              <Label className="text-sm font-medium">
                {t('sales.dialogs.sell.broker')}
              </Label>
              <Select value={selectedBrokerId} onValueChange={setSelectedBrokerId}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder={t('sales.dialogs.sell.noBroker')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" className="text-xs">
                    {t('sales.dialogs.sell.noBroker')}
                  </SelectItem>
                  {brokerAgreements.map((a) => (
                    <SelectItem key={a.id} value={a.id} className="text-xs">
                      {a.agentName}
                      {' — '}
                      {a.commissionType === 'percentage' && a.commissionPercentage !== null
                        ? `${a.commissionPercentage}%`
                        : a.commissionFixedAmount !== null
                          ? `${a.commissionFixedAmount}€`
                          : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedBrokerId !== 'none' && finalPrice > 0 && (() => {
                const agr = brokerAgreements.find((a) => a.id === selectedBrokerId);
                if (!agr) return null;
                const comm = calculateCommission({
                  commissionType: agr.commissionType,
                  salePrice: finalPrice,
                  commissionPercentage: agr.commissionPercentage,
                  commissionFixedAmount: agr.commissionFixedAmount,
                });
                return (
                  <p className={cn("text-xs", colors.text.muted)}>
                    {t('sales.dialogs.sell.commissionPreview')}:{' '}
                    <span className="font-medium">{formatCurrency(comm)}</span>
                  </p>
                );
              })()}
              <p className={cn("text-xs", colors.text.muted)}>
                {t('sales.legal.addBrokerHint')}
              </p>
            </fieldset>
          )}

          {brokerAgreements.length === 0 && (
            <p className={cn("text-xs", colors.text.muted)}>
              {t('sales.legal.addBrokerHint')}
            </p>
          )}

          {linkedSpaces.hasSpaces && (
            <AppurtenancesSection
              spaces={linkedSpaces.spaces}
              unitPrice={finalPrice}
              totalAppurtenancesPrice={linkedSpaces.totalAppurtenancesPrice}
              onToggle={linkedSpaces.toggleSpace}
              onPriceChange={linkedSpaces.setSpacePrice}
            />
          )}

          <p className={cn("text-xs", colors.text.muted)}>
            {t('sales.dialogs.sell.warning')}
          </p>
        </section>

        <SalesValidationAlert i18nKeys={sellHasArea ? [] : ['sales.errors.noArea']} />
        <SalesValidationAlert i18nKeys={hierarchy.errors.map((err) => err.i18nKey)} />
        <SalesSaveError message={mutation.saveError} />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.saving}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleSave}
            disabled={mutation.saving || mutation.checking || finalPrice <= 0 || !isOwnersValid(owners) || !hierarchy.isValid || !sellHasArea}
            className={cn(colors.bg.success, "hover:opacity-90 text-white")}
          >
            {mutation.saving
              ? t('common.saving')
              : t('sales.dialogs.sell.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
      </Dialog>
      {mutation.impactDialog}
    </>
  );
}
