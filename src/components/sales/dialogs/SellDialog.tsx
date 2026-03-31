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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle, AlertTriangle } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import { OwnersList } from '@/components/shared/owners/OwnersList';
import { isOwnersValid, formatOwnerNames, getPrimaryBuyerContactId, buildOwnerFields } from '@/lib/ownership/owner-utils';
import { AppurtenancesSection } from './AppurtenancesSection';
import type { PropertyOwnerEntry } from '@/types/ownership-table';
import { useLinkedSpacesForSale } from '@/hooks/sales/useLinkedSpacesForSale';
import { useContactEmailWatch } from '@/hooks/sales/useContactEmailWatch';
import { usePropertyHierarchyValidation } from '@/hooks/sales/usePropertyHierarchyValidation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BrokerageService } from '@/services/brokerage.service';
import { calculateCommission } from '@/types/brokerage';
import type { BrokerageAgreement } from '@/types/brokerage';
import { createModuleLogger } from '@/lib/telemetry';
import '@/lib/design-system';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { resolveProjectId, translateServerError } from './sales-dialog-utils';
import type { BaseDialogProps } from './sales-dialog-utils';

const logger = createModuleLogger('SellDialog');

export function SellDialog({ unit, open, onOpenChange, onSuccess }: BaseDialogProps) {
  const colors = useSemanticColors();
  const { t } = useTranslation('common');
  const iconSizes = useIconSizes();
  const [finalPrice, setFinalPrice] = useState<string>(
    unit.commercial?.askingPrice?.toString() ?? ''
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>('');

  const existingOwners = (unit.commercial?.owners as PropertyOwnerEntry[] | null | undefined) ?? null;

  const [owners, setOwners] = useState<PropertyOwnerEntry[]>(() => {
    if (existingOwners && existingOwners.length > 0) return existingOwners;
    return [];
  });

  const buyerContactId = getPrimaryBuyerContactId(owners) ?? '';
  const buyerName = formatOwnerNames(owners) ?? '';
  const hasExistingOwners = Boolean(existingOwners?.length);

  const { hasEmail: buyerHasEmail } = useContactEmailWatch(buyerContactId);
  const hierarchy = usePropertyHierarchyValidation(unit, open);

  const sellNetArea = unit.area ?? 0;
  const sellGrossArea = (unit.areas as Record<string, number> | undefined)?.gross ?? 0;
  const sellHasArea = sellNetArea > 0 || sellGrossArea > 0;

  const linkedSpaces = useLinkedSpacesForSale(unit);
  const [brokerAgreements, setBrokerAgreements] = useState<BrokerageAgreement[]>([]);
  const [selectedBrokerId, setSelectedBrokerId] = useState<string>('none');

  useEffect(() => {
    if (open) {
      setFinalPrice(unit.commercial?.askingPrice?.toString() ?? '');
      setSelectedBrokerId('none');

      const unitOwners = (unit.commercial?.owners as PropertyOwnerEntry[] | null | undefined) ?? null;
      if (unitOwners && unitOwners.length > 0) {
        setOwners(unitOwners);
      } else {
        setOwners([]);
      }

      BrokerageService.getAgreements(resolveProjectId(unit) ?? '', unit.id, 'active')
        .then(setBrokerAgreements)
        .catch(() => setBrokerAgreements([]));
    }
  }, [open, unit.commercial?.askingPrice, unit.commercial?.owners, unit.project, unit.id]);

  const handleSave = useCallback(async () => {
    const price = Number(finalPrice);
    if (isNaN(price) || price <= 0 || !buyerContactId) return;

    setSaving(true);
    setSaveError('');
    try {
      await apiClient.patch(API_ROUTES.UNITS.BY_ID(unit.id), {
        commercialStatus: 'sold',
        commercial: {
          askingPrice: unit.commercial?.askingPrice ?? null,
          finalPrice: price,
          reservationDeposit: unit.commercial?.reservationDeposit ?? null,
          ...buildOwnerFields(owners),
          reservationDate: unit.commercial?.reservationDate ?? null,
          saleDate: new Date().toISOString(),
          cancellationDate: unit.commercial?.cancellationDate ?? null,
          listedDate: unit.commercial?.listedDate ?? null,
          transactionChainId: unit.commercial?.transactionChainId ?? null,
        },
      } as Record<string, unknown>);
      onOpenChange(false);
      onSuccess?.();

      const unitName = unit.name ?? unit.unitName ?? '';
      const selectedSpaces = linkedSpaces.getSelectedSpaces();
      const lineItems = selectedSpaces.length > 0
        ? linkedSpaces.buildLineItems(price, unitName)
        : undefined;

      apiClient.post(API_ROUTES.SALES.ACCOUNTING_EVENT(unit.id), {
        eventType: 'final_sale_invoice',
        unitId: unit.id, unitName,
        projectId: resolveProjectId(unit) ?? null,
        buyerContactId: buyerContactId || null,
        buyerName: buyerName || null,
        projectName: null, permitTitle: null, companyName: null,
        buildingName: null, unitFloor: unit.floor ?? null,
        projectAddress: null, paymentMethod: 'bank_transfer', notes: null,
        finalPrice: price,
        depositAlreadyInvoiced: unit.commercial?.reservationDeposit ?? 0,
        lineItems,
      }).catch((err: unknown) => {
        logger.warn('Final sale invoice failed', { error: err });
      });

      if (selectedBrokerId !== 'none') {
        const agreement = brokerAgreements.find((a) => a.id === selectedBrokerId);
        if (agreement) {
          BrokerageService.recordCommission(
            {
              brokerageAgreementId: agreement.id,
              agentContactId: agreement.agentContactId,
              agentName: agreement.agentName,
              unitId: unit.id,
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
        }
      }

      if (selectedSpaces.length > 0) {
        apiClient.post(API_ROUTES.SALES.APPURTENANCE_SYNC(unit.id), {
          action: 'sell',
          spaces: linkedSpaces.buildSyncPayload('sell'),
          ...buildOwnerFields(owners),
        }).catch((err: unknown) => {
          logger.warn('Appurtenance sync failed', { error: err });
        });
      }
    } catch (err: unknown) {
      const errorObj = err as { message?: string; error?: string };
      const rawMsg = errorObj?.error ?? errorObj?.message ?? '';
      const msg = rawMsg
        ? translateServerError(rawMsg, t)
        : t('sales.dialogs.sell.unknownError', { defaultValue: 'Σφάλμα κατά την πώληση' });
      setSaveError(msg);
      logger.warn('Sell failed', { error: rawMsg });
    } finally {
      setSaving(false);
    }
  }, [finalPrice, owners, buyerContactId, buyerName, unit, onOpenChange, onSuccess, linkedSpaces, selectedBrokerId, brokerAgreements, t]);

  const askingPrice = unit.commercial?.askingPrice;
  const discount = askingPrice && Number(finalPrice) > 0
    ? ((askingPrice - Number(finalPrice)) / askingPrice * 100).toFixed(1)
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className={cn(iconSizes.sm, colors.text.success)} />
            {t('sales.dialogs.sell.title', { defaultValue: 'Πώληση Μονάδας' })}
          </DialogTitle>
          <DialogDescription>
            {t('sales.dialogs.sell.description', {
              defaultValue: 'Επιβεβαιώστε την τελική τιμή πώλησης',
            })}
          </DialogDescription>
        </DialogHeader>

        <section className="space-y-3 py-2">
          <OwnersList owners={owners} onChange={setOwners} defaultRole="buyer" disabled={saving} readOnly={hasExistingOwners} />
          {!hasExistingOwners && buyerContactId && !buyerHasEmail && (
            <p className={cn("flex items-center gap-1.5 text-xs", colors.text.warning)}>
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {t('sales.dialogs.reserve.noEmailWarning', {
                defaultValue: 'Ο αγοραστής δεν έχει email — δεν θα σταλεί επιβεβαίωση πώλησης. Ενημερώστε την καρτέλα του.',
              })}
            </p>
          )}

          {askingPrice && (
            <p className={cn("text-sm", colors.text.muted)}>
              {t('sales.dialogs.sell.askingWas', { defaultValue: 'Ζητούμενη τιμή' })}:{' '}
              <span className="font-medium text-foreground">{formatCurrency(askingPrice)}</span>
            </p>
          )}

          <Label className="text-sm font-medium">
            {t('sales.dialogs.sell.finalPrice', { defaultValue: 'Τελική τιμή πώλησης (€)' })}
          </Label>
          <Input
            type="number" min={0} step={1000}
            value={finalPrice}
            onChange={(e) => setFinalPrice(e.target.value)}
            placeholder={t('sales.dialogs.sell.finalPricePlaceholder', { defaultValue: 'π.χ. 145000' })}
            className="text-right" autoFocus
          />

          {discount && Number(discount) > 0 && (
            <p className={cn("text-xs", colors.text.warning)}>
              {t('sales.dialogs.sell.discount', { defaultValue: 'Έκπτωση' })}: −{discount}%
            </p>
          )}

          {brokerAgreements.length > 0 && (
            <fieldset className="space-y-1">
              <Label className="text-sm font-medium">
                {t('sales.dialogs.sell.broker', { defaultValue: 'Μεσίτης (προαιρετικό)' })}
              </Label>
              <Select value={selectedBrokerId} onValueChange={setSelectedBrokerId}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder={t('sales.dialogs.sell.noBroker', { defaultValue: 'Χωρίς μεσίτη' })} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" className="text-xs">
                    {t('sales.dialogs.sell.noBroker', { defaultValue: 'Χωρίς μεσίτη' })}
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
              {selectedBrokerId !== 'none' && Number(finalPrice) > 0 && (() => {
                const agr = brokerAgreements.find((a) => a.id === selectedBrokerId);
                if (!agr) return null;
                const comm = calculateCommission({
                  commissionType: agr.commissionType,
                  salePrice: Number(finalPrice),
                  commissionPercentage: agr.commissionPercentage,
                  commissionFixedAmount: agr.commissionFixedAmount,
                });
                return (
                  <p className={cn("text-xs", colors.text.muted)}>
                    {t('sales.dialogs.sell.commissionPreview', { defaultValue: 'Προμήθεια' })}:{' '}
                    <span className="font-medium">{formatCurrency(comm)}</span>
                  </p>
                );
              })()}
              <p className={cn("text-xs", colors.text.muted)}>
                {t('sales.legal.addBrokerHint', { defaultValue: 'Προσθέστε μεσίτη από το tab Μεσίτες του έργου' })}
              </p>
            </fieldset>
          )}

          {brokerAgreements.length === 0 && (
            <p className={cn("text-xs", colors.text.muted)}>
              {t('sales.legal.addBrokerHint', { defaultValue: 'Προσθέστε μεσίτη από το tab Μεσίτες του έργου' })}
            </p>
          )}

          {linkedSpaces.hasSpaces && (
            <AppurtenancesSection
              spaces={linkedSpaces.spaces}
              unitPrice={Number(finalPrice) || 0}
              totalAppurtenancesPrice={linkedSpaces.totalAppurtenancesPrice}
              onToggle={linkedSpaces.toggleSpace}
              onPriceChange={linkedSpaces.setSpacePrice}
            />
          )}

          <p className={cn("text-xs", colors.text.muted)}>
            {t('sales.dialogs.sell.warning', {
              defaultValue: 'Η μονάδα θα μεταβεί σε κατάσταση «Πωλήθηκε» και δεν θα εμφανίζεται πλέον στις διαθέσιμες.',
            })}
          </p>
        </section>

        {!sellHasArea && (
          <aside className="space-y-1.5 rounded-md border border-destructive/30 bg-destructive/5 p-3">
            <p className="flex items-center gap-1.5 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {t('sales.errors.noArea', { defaultValue: 'Η μονάδα δεν έχει εμβαδόν (τ.μ.). Ορίστε καθαρά ή μικτά τ.μ. πριν την πώληση.' })}
            </p>
          </aside>
        )}

        {!hierarchy.loading && hierarchy.errors.length > 0 && (
          <aside className="space-y-1.5 rounded-md border border-destructive/30 bg-destructive/5 p-3">
            {hierarchy.errors.map((err) => (
              <p key={err.i18nKey} className="flex items-center gap-1.5 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {t(err.i18nKey)}
              </p>
            ))}
          </aside>
        )}

        {saveError && (
          <p className="flex items-center gap-1.5 text-sm text-destructive px-1">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {saveError}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t('common.cancel', { defaultValue: 'Ακύρωση' })}
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !finalPrice || Number(finalPrice) <= 0 || !isOwnersValid(owners) || !hierarchy.isValid || !sellHasArea}
            className={cn(colors.bg.success, "hover:opacity-90 text-white")}
          >
            {saving
              ? t('common.saving', { defaultValue: 'Αποθήκευση...' })
              : t('sales.dialogs.sell.confirm', { defaultValue: 'Επιβεβαίωση Πώλησης' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
