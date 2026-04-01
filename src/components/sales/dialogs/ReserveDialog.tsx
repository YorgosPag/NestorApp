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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserCheck, UserPlus, AlertTriangle } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import { TabbedAddNewContactDialog } from '@/components/contacts/dialogs/TabbedAddNewContactDialog';
import { OwnersList } from '@/components/shared/owners/OwnersList';
import { isOwnersValid, formatOwnerNames, getPrimaryBuyerContactId, buildOwnerFields } from '@/lib/ownership/owner-utils';
import { AppurtenancesSection } from './AppurtenancesSection';
import type { PropertyOwnerEntry } from '@/types/ownership-table';
import { useLinkedSpacesForSale } from '@/hooks/sales/useLinkedSpacesForSale';
import { useContactEmailWatch } from '@/hooks/sales/useContactEmailWatch';
import { usePropertyHierarchyValidation } from '@/hooks/sales/usePropertyHierarchyValidation';
import { createModuleLogger } from '@/lib/telemetry';
import '@/lib/design-system';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { resolveProjectId, translateServerError } from './sales-dialog-utils';
import type { BaseDialogProps } from './sales-dialog-utils';

const logger = createModuleLogger('ReserveDialog');

export function ReserveDialog({ unit, open, onOpenChange, onSuccess }: BaseDialogProps) {
  const colors = useSemanticColors();
  const { t } = useTranslation('common');
  const iconSizes = useIconSizes();
  const [deposit, setDeposit] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>('');

  // ADR-244: Multi-buyer owners state
  const [owners, setOwners] = useState<PropertyOwnerEntry[]>([]);
  const buyerContactId = getPrimaryBuyerContactId(owners) ?? '';
  const buyerName = formatOwnerNames(owners) ?? '';

  const { hasEmail: buyerHasEmail } = useContactEmailWatch(buyerContactId);
  const hierarchy = usePropertyHierarchyValidation(unit, open);

  const hasAskingPrice = (unit.commercial?.askingPrice ?? 0) > 0;
  const netArea = unit.area ?? 0;
  const grossArea = (unit.areas as Record<string, number> | undefined)?.gross ?? 0;
  const hasArea = netArea > 0 || grossArea > 0;

  const linkedSpaces = useLinkedSpacesForSale(unit);

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

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveError('');
    try {
      await apiClient.patch(API_ROUTES.PROPERTIES.BY_ID(unit.id), {
        commercialStatus: 'reserved',
        commercial: {
          askingPrice: unit.commercial?.askingPrice ?? null,
          finalPrice: unit.commercial?.finalPrice ?? null,
          reservationDeposit: deposit ? Number(deposit) : null,
          ...buildOwnerFields(owners),
          reservationDate: new Date().toISOString(),
          saleDate: unit.commercial?.saleDate ?? null,
          cancellationDate: unit.commercial?.cancellationDate ?? null,
          listedDate: unit.commercial?.listedDate ?? new Date().toISOString(),
          transactionChainId: unit.commercial?.transactionChainId ?? null,
        },
      } as Record<string, unknown>);
      onOpenChange(false);
      onSuccess?.();

      // Fire-and-forget: email + invoice
      const depositAmount = Number(deposit);
      const propertyName = unit.name ?? unit.propertyName ?? '';
      const selectedSpaces = linkedSpaces.getSelectedSpaces();
      const lineItems = selectedSpaces.length > 0
        ? linkedSpaces.buildLineItems(depositAmount, propertyName)
        : undefined;

      if (buyerContactId) {
        apiClient.post(API_ROUTES.SALES.ACCOUNTING_EVENT(unit.id), {
          eventType: 'reservation_notify',
          propertyId: unit.id,
          propertyName,
          projectId: resolveProjectId(unit) ?? null,
          buyerContactId,
          buyerName: buyerName || null,
          projectName: null,
          permitTitle: null,
          companyName: null,
          buildingName: null,
          unitFloor: unit.floor ?? null,
          projectAddress: null,
          paymentMethod: 'bank_transfer',
          notes: null,
          depositAmount: depositAmount || 0,
        }).catch((err: unknown) => {
          logger.warn('Reservation notify failed', { error: err });
        });
      }

      if (depositAmount > 0) {
        apiClient.post(API_ROUTES.SALES.ACCOUNTING_EVENT(unit.id), {
          eventType: 'deposit_invoice',
          propertyId: unit.id,
          propertyName,
          projectId: resolveProjectId(unit) ?? null,
          buyerContactId: buyerContactId || null,
          buyerName: buyerName || null,
          projectName: null,
          permitTitle: null,
          companyName: null,
          buildingName: null,
          unitFloor: unit.floor ?? null,
          projectAddress: null,
          paymentMethod: 'bank_transfer',
          notes: null,
          depositAmount,
          lineItems,
        }).catch((err: unknown) => {
          logger.warn('Deposit invoice failed', { error: err });
        });
      }

      if (selectedSpaces.length > 0) {
        apiClient.post(API_ROUTES.SALES.APPURTENANCE_SYNC(unit.id), {
          action: 'reserve',
          spaces: linkedSpaces.buildSyncPayload('reserve'),
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
        : t('sales.dialogs.reserve.unknownError', { defaultValue: 'Σφάλμα κατά την κράτηση' });
      setSaveError(msg);
      logger.warn('Reserve failed', { error: rawMsg });
    } finally {
      setSaving(false);
    }
  }, [deposit, owners, buyerContactId, buyerName, unit, onOpenChange, onSuccess, linkedSpaces, t]);

  return (
    <>
      <Dialog open={open && activeDialog === 'reserve'} onOpenChange={handleReserveOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className={cn(iconSizes.sm, colors.text.accent)} />
              {t('sales.dialogs.reserve.title', { defaultValue: 'Κράτηση Μονάδας' })}
            </DialogTitle>
            <DialogDescription>
              {t('sales.dialogs.reserve.description', {
                defaultValue: 'Καταχωρήστε τα στοιχεία κράτησης',
              })}
            </DialogDescription>
          </DialogHeader>

          <section className="space-y-3 py-2">
            <OwnersList owners={owners} onChange={setOwners} defaultRole="buyer" disabled={saving} />
            {buyerContactId && !buyerHasEmail && (
              <p className={cn("flex items-center gap-1.5 text-xs", colors.text.warning)}>
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {t('sales.dialogs.reserve.noEmailWarning', {
                  defaultValue: 'Ο αγοραστής δεν έχει email — δεν θα σταλεί επιβεβαίωση κράτησης. Ενημερώστε την καρτέλα του.',
                })}
              </p>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn("gap-1 text-xs", colors.text.muted)}
              onClick={handleOpenNewContact}
            >
              <UserPlus className={iconSizes.xs} />
              {t('sales.dialogs.reserve.newContact', { defaultValue: 'Δημιουργία νέας επαφής' })}
            </Button>

            <fieldset className="space-y-1">
              <Label className="text-sm font-medium">
                {t('sales.dialogs.reserve.deposit', { defaultValue: 'Προκαταβολή (€)' })}
              </Label>
              <Input
                type="number"
                min={0}
                step={500}
                value={deposit}
                onChange={(e) => setDeposit(e.target.value)}
                placeholder={t('sales.dialogs.reserve.depositPlaceholder', { defaultValue: 'π.χ. 5000' })}
                className="text-right"
              />
            </fieldset>

            {linkedSpaces.hasSpaces && (
              <AppurtenancesSection
                spaces={linkedSpaces.spaces}
                unitPrice={Number(deposit) || 0}
                totalAppurtenancesPrice={linkedSpaces.totalAppurtenancesPrice}
                onToggle={linkedSpaces.toggleSpace}
                onPriceChange={linkedSpaces.setSpacePrice}
              />
            )}
          </section>

          {(!hasAskingPrice || !hasArea) && (
            <aside className="space-y-1.5 rounded-md border border-destructive/30 bg-destructive/5 p-3">
              {!hasAskingPrice && (
                <p className="flex items-center gap-1.5 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {t('sales.errors.noAskingPrice', { defaultValue: 'Η μονάδα δεν έχει ζητούμενη τιμή. Ορίστε τιμή πριν την κράτηση.' })}
                </p>
              )}
              {!hasArea && (
                <p className="flex items-center gap-1.5 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {t('sales.errors.noArea', { defaultValue: 'Η μονάδα δεν έχει εμβαδόν (τ.μ.). Ορίστε καθαρά ή μικτά τ.μ. πριν την κράτηση.' })}
                </p>
              )}
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
            <Button onClick={handleSave} disabled={saving || !isOwnersValid(owners) || !hierarchy.isValid || !hasAskingPrice || !hasArea}>
              {saving
                ? t('common.saving', { defaultValue: 'Αποθήκευση...' })
                : t('sales.dialogs.reserve.confirm', { defaultValue: 'Κράτηση' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TabbedAddNewContactDialog
        open={open && activeDialog === 'new-contact'}
        onOpenChange={handleNewContactCancel}
        onContactAdded={handleNewContactCreated}
      />
    </>
  );
}
