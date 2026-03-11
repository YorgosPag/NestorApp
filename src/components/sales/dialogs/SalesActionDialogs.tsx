'use client';

/**
 * @fileoverview Sales Action Dialogs — ADR-197 §2.9
 * @description 3 dialog components for commercial actions: Change Price, Reserve, Sell
 * @pattern Enterprise dialog pattern with Radix UI primitives
 */

import React, { useState, useCallback, useEffect } from 'react';
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
import { DollarSign, UserCheck, CheckCircle, Undo2, UserPlus } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { ContactSearchManager } from '@/components/contacts/relationships/ContactSearchManager';
import { TabbedAddNewContactDialog } from '@/components/contacts/dialogs/TabbedAddNewContactDialog';
import { AppurtenancesSection } from './AppurtenancesSection';
import { useLinkedSpacesForSale } from '@/hooks/sales/useLinkedSpacesForSale';
import type { ContactSummary } from '@/components/ui/enterprise-contact-dropdown';
import type { Unit } from '@/types/unit';

// =============================================================================
// 🏢 SHARED TYPES
// =============================================================================

interface BaseDialogProps {
  unit: Unit;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

// =============================================================================
// 🏢 1. ΑΛΛΑΓΗ ΤΙΜΗΣ (Change Price)
// =============================================================================

export function ChangePriceDialog({ unit, open, onOpenChange, onSuccess }: BaseDialogProps) {
  const { t } = useTranslation('common');
  const iconSizes = useIconSizes();
  const [askingPrice, setAskingPrice] = useState<string>(
    unit.commercial?.askingPrice?.toString() ?? ''
  );
  const [saving, setSaving] = useState(false);

  // Sync state when dialog opens or unit data changes
  useEffect(() => {
    if (open) {
      setAskingPrice(unit.commercial?.askingPrice?.toString() ?? '');
    }
  }, [open, unit.commercial?.askingPrice]);

  const handleSave = useCallback(async () => {
    const price = Number(askingPrice);
    if (isNaN(price) || price <= 0) return;

    setSaving(true);
    try {
      await apiClient.patch(`/api/units/${unit.id}`, {
        commercialStatus: unit.commercialStatus ?? 'for-sale',
        commercial: {
          askingPrice: price,
          finalPrice: unit.commercial?.finalPrice ?? null,
          reservationDeposit: unit.commercial?.reservationDeposit ?? null,
          buyerContactId: unit.commercial?.buyerContactId ?? null,
          buyerName: unit.commercial?.buyerName ?? null,
          reservationDate: unit.commercial?.reservationDate ?? null,
          saleDate: unit.commercial?.saleDate ?? null,
          cancellationDate: unit.commercial?.cancellationDate ?? null,
          listedDate: unit.commercial?.listedDate ?? new Date().toISOString(),
          transactionChainId: unit.commercial?.transactionChainId ?? null,
        },
      } as Record<string, unknown>);
      onOpenChange(false);
      onSuccess?.();
    } catch {
      // Error handled by service
    } finally {
      setSaving(false);
    }
  }, [askingPrice, unit, onOpenChange, onSuccess]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className={`${iconSizes.sm} text-blue-600`} />
            {t('sales.dialogs.changePrice.title', { defaultValue: 'Αλλαγή Τιμής' })}
          </DialogTitle>
          <DialogDescription>
            {t('sales.dialogs.changePrice.description', {
              defaultValue: 'Ορίστε τη ζητούμενη τιμή για τη μονάδα',
            })}
          </DialogDescription>
        </DialogHeader>

        <fieldset className="space-y-3 py-2">
          <Label className="text-sm font-medium">
            {t('sales.dialogs.changePrice.askingPrice', { defaultValue: 'Ζητούμενη τιμή (€)' })}
          </Label>
          <Input
            type="number"
            min={0}
            step={1000}
            value={askingPrice}
            onChange={(e) => setAskingPrice(e.target.value)}
            placeholder="π.χ. 150000"
            className="text-right"
            autoFocus
          />
          <p className="text-xs text-muted-foreground">
            {t('sales.dialogs.changePrice.hint', {
              defaultValue: 'Η μονάδα θα μπει αυτόματα σε κατάσταση "Προς πώληση"',
            })}
          </p>
        </fieldset>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t('common.cancel', { defaultValue: 'Ακύρωση' })}
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !askingPrice || Number(askingPrice) <= 0}
          >
            {saving
              ? t('common.saving', { defaultValue: 'Αποθήκευση...' })
              : t('common.save', { defaultValue: 'Αποθήκευση' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// 🏢 2. ΚΡΑΤΗΣΗ (Reserve)
// =============================================================================

export function ReserveDialog({ unit, open, onOpenChange, onSuccess }: BaseDialogProps) {
  const { t } = useTranslation('common');
  const iconSizes = useIconSizes();
  const [deposit, setDeposit] = useState<string>('');
  const [buyerContactId, setBuyerContactId] = useState<string>('');
  const [buyerName, setBuyerName] = useState<string>('');
  const [saving, setSaving] = useState(false);

  // ADR-199: Linked spaces (appurtenances)
  const linkedSpaces = useLinkedSpacesForSale(unit);

  // 🏢 ENTERPRISE: Dialog switching pattern — Radix Dialog cannot nest modals,
  // so we swap between Reserve ↔ NewContact using a single active-dialog state.
  // 'reserve' = show reservation form, 'new-contact' = show contact creation form.
  const [activeDialog, setActiveDialog] = useState<'reserve' | 'new-contact'>('reserve');

  // Reset to reserve view when the dialog opens
  const handleReserveOpenChange = useCallback((isOpen: boolean) => {
    if (!isOpen) {
      setActiveDialog('reserve');
    }
    onOpenChange(isOpen);
  }, [onOpenChange]);

  const handleContactSelect = useCallback((contact: ContactSummary | null) => {
    setBuyerContactId(contact?.id ?? '');
    setBuyerName(contact?.name ?? '');
  }, []);

  // 🏢 ENTERPRISE: Switch to new contact dialog — hides Reserve, shows Contact form
  const handleOpenNewContact = useCallback(() => {
    setActiveDialog('new-contact');
  }, []);

  // 🏢 ENTERPRISE: After new contact created — switch back to Reserve dialog
  const handleNewContactCreated = useCallback(() => {
    setActiveDialog('reserve');
    // ContactSearchManager will auto-reload contacts on re-mount
  }, []);

  const handleNewContactCancel = useCallback((isOpen: boolean) => {
    if (!isOpen) {
      setActiveDialog('reserve');
    }
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await apiClient.patch(`/api/units/${unit.id}`, {
        commercialStatus: 'reserved',
        commercial: {
          askingPrice: unit.commercial?.askingPrice ?? null,
          finalPrice: unit.commercial?.finalPrice ?? null,
          reservationDeposit: deposit ? Number(deposit) : null,
          buyerContactId: buyerContactId || null,
          buyerName: buyerName || null,
          reservationDate: new Date().toISOString(),
          saleDate: unit.commercial?.saleDate ?? null,
          cancellationDate: unit.commercial?.cancellationDate ?? null,
          listedDate: unit.commercial?.listedDate ?? new Date().toISOString(),
          transactionChainId: unit.commercial?.transactionChainId ?? null,
        },
      } as Record<string, unknown>);
      onOpenChange(false);
      onSuccess?.();

      // ADR-198: Fire-and-forget — δημιουργία τιμολογίου προκαταβολής
      const depositAmount = Number(deposit);
      const unitName = unit.name ?? unit.unitName ?? '';

      // ADR-199: Build multi-line items if appurtenances selected
      const selectedSpaces = linkedSpaces.getSelectedSpaces();
      const lineItems = selectedSpaces.length > 0
        ? linkedSpaces.buildLineItems(depositAmount, unitName)
        : undefined;

      if (depositAmount > 0) {
        apiClient.post(`/api/sales/${unit.id}/accounting-event`, {
          eventType: 'deposit_invoice',
          unitId: unit.id,
          unitName,
          projectId: unit.project ?? null,
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
          console.warn('[ADR-198] Deposit invoice fire-and-forget failed:', err);
        });
      }

      // ADR-199: Sync appurtenance commercial status
      if (selectedSpaces.length > 0) {
        const syncPayload = linkedSpaces.buildSyncPayload('reserve');
        apiClient.post(`/api/sales/${unit.id}/appurtenance-sync`, {
          action: 'reserve',
          spaces: syncPayload,
          buyerContactId: buyerContactId || null,
          buyerName: buyerName || null,
        }).catch((err: unknown) => {
          console.warn('[ADR-199] Appurtenance sync fire-and-forget failed:', err);
        });
      }
    } catch {
      // Error handled by service
    } finally {
      setSaving(false);
    }
  }, [deposit, buyerContactId, buyerName, unit, onOpenChange, onSuccess, linkedSpaces]);

  return (
    <>
      {/* 🏢 RESERVE DIALOG — visible only when activeDialog === 'reserve' */}
      <Dialog open={open && activeDialog === 'reserve'} onOpenChange={handleReserveOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className={`${iconSizes.sm} text-purple-600`} />
              {t('sales.dialogs.reserve.title', { defaultValue: 'Κράτηση Μονάδας' })}
            </DialogTitle>
            <DialogDescription>
              {t('sales.dialogs.reserve.description', {
                defaultValue: 'Καταχωρήστε τα στοιχεία κράτησης',
              })}
            </DialogDescription>
          </DialogHeader>

          <section className="space-y-3 py-2">
            {/* 🏢 ENTERPRISE: Contact search dropdown with create-new button */}
            <fieldset className="space-y-1">
              <ContactSearchManager
                selectedContactId={buyerContactId}
                onContactSelect={handleContactSelect}
                label={t('sales.dialogs.reserve.buyerName', { defaultValue: 'Αγοραστής' })}
                placeholder={t('sales.dialogs.reserve.buyerPlaceholder', { defaultValue: 'Αναζήτηση επαφής...' })}
                allowedContactTypes={['individual', 'company']}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1 text-xs text-muted-foreground"
                onClick={handleOpenNewContact}
              >
                <UserPlus className={iconSizes.xs} />
                {t('sales.dialogs.reserve.newContact', { defaultValue: 'Δημιουργία νέας επαφής' })}
              </Button>
            </fieldset>

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
                placeholder="π.χ. 5000"
                className="text-right"
              />
            </fieldset>

            {/* ADR-199: Linked parking/storage appurtenances */}
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

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              {t('common.cancel', { defaultValue: 'Ακύρωση' })}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving
                ? t('common.saving', { defaultValue: 'Αποθήκευση...' })
                : t('sales.dialogs.reserve.confirm', { defaultValue: 'Κράτηση' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 🏢 NEW CONTACT DIALOG — swaps in when user clicks "Δημιουργία νέας επαφής" */}
      <TabbedAddNewContactDialog
        open={open && activeDialog === 'new-contact'}
        onOpenChange={handleNewContactCancel}
        onContactAdded={handleNewContactCreated}
      />
    </>
  );
}

// =============================================================================
// 🏢 3. ΠΩΛΗΣΗ (Sell)
// =============================================================================

export function SellDialog({ unit, open, onOpenChange, onSuccess }: BaseDialogProps) {
  const { t } = useTranslation('common');
  const iconSizes = useIconSizes();
  const [finalPrice, setFinalPrice] = useState<string>(
    unit.commercial?.askingPrice?.toString() ?? ''
  );
  const [saving, setSaving] = useState(false);

  // ADR-199: Linked spaces (appurtenances)
  const linkedSpaces = useLinkedSpacesForSale(unit);

  // Sync state when dialog opens or unit asking price changes
  useEffect(() => {
    if (open) {
      setFinalPrice(unit.commercial?.askingPrice?.toString() ?? '');
    }
  }, [open, unit.commercial?.askingPrice]);

  const handleSave = useCallback(async () => {
    const price = Number(finalPrice);
    if (isNaN(price) || price <= 0) return;

    setSaving(true);
    try {
      await apiClient.patch(`/api/units/${unit.id}`, {
        commercialStatus: 'sold',
        commercial: {
          askingPrice: unit.commercial?.askingPrice ?? null,
          finalPrice: price,
          reservationDeposit: unit.commercial?.reservationDeposit ?? null,
          buyerContactId: unit.commercial?.buyerContactId ?? null,
          buyerName: unit.commercial?.buyerName ?? null,
          reservationDate: unit.commercial?.reservationDate ?? null,
          saleDate: new Date().toISOString(),
          cancellationDate: unit.commercial?.cancellationDate ?? null,
          listedDate: unit.commercial?.listedDate ?? null,
          transactionChainId: unit.commercial?.transactionChainId ?? null,
        },
      } as Record<string, unknown>);
      onOpenChange(false);
      onSuccess?.();

      // ADR-198 + ADR-199: Fire-and-forget — τιμολόγιο τελικής πώλησης
      const unitName = unit.name ?? unit.unitName ?? '';
      const selectedSpaces = linkedSpaces.getSelectedSpaces();
      const lineItems = selectedSpaces.length > 0
        ? linkedSpaces.buildLineItems(price, unitName)
        : undefined;

      apiClient.post(`/api/sales/${unit.id}/accounting-event`, {
        eventType: 'final_sale_invoice',
        unitId: unit.id,
        unitName,
        projectId: unit.project ?? null,
        buyerContactId: unit.commercial?.buyerContactId ?? null,
        buyerName: unit.commercial?.buyerName ?? null,
        projectName: null,
        permitTitle: null,
        companyName: null,
        buildingName: null,
        unitFloor: unit.floor ?? null,
        projectAddress: null,
        paymentMethod: 'bank_transfer',
        notes: null,
        finalPrice: price,
        depositAlreadyInvoiced: unit.commercial?.reservationDeposit ?? 0,
        lineItems,
      }).catch((err: unknown) => {
        console.warn('[ADR-198] Final sale invoice fire-and-forget failed:', err);
      });

      // ADR-199: Sync appurtenance commercial status
      if (selectedSpaces.length > 0) {
        const syncPayload = linkedSpaces.buildSyncPayload('sell');
        apiClient.post(`/api/sales/${unit.id}/appurtenance-sync`, {
          action: 'sell',
          spaces: syncPayload,
          buyerContactId: unit.commercial?.buyerContactId ?? null,
          buyerName: unit.commercial?.buyerName ?? null,
        }).catch((err: unknown) => {
          console.warn('[ADR-199] Appurtenance sync fire-and-forget failed:', err);
        });
      }
    } catch {
      // Error handled by service
    } finally {
      setSaving(false);
    }
  }, [finalPrice, unit, onOpenChange, onSuccess, linkedSpaces]);

  const askingPrice = unit.commercial?.askingPrice;
  const discount = askingPrice && Number(finalPrice) > 0
    ? ((askingPrice - Number(finalPrice)) / askingPrice * 100).toFixed(1)
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className={`${iconSizes.sm} text-green-600`} />
            {t('sales.dialogs.sell.title', { defaultValue: 'Πώληση Μονάδας' })}
          </DialogTitle>
          <DialogDescription>
            {t('sales.dialogs.sell.description', {
              defaultValue: 'Επιβεβαιώστε την τελική τιμή πώλησης',
            })}
          </DialogDescription>
        </DialogHeader>

        <fieldset className="space-y-3 py-2">
          {askingPrice && (
            <p className="text-sm text-muted-foreground">
              {t('sales.dialogs.sell.askingWas', { defaultValue: 'Ζητούμενη τιμή' })}:{' '}
              <span className="font-medium text-foreground">
                €{askingPrice.toLocaleString('el-GR')}
              </span>
            </p>
          )}

          <Label className="text-sm font-medium">
            {t('sales.dialogs.sell.finalPrice', { defaultValue: 'Τελική τιμή πώλησης (€)' })}
          </Label>
          <Input
            type="number"
            min={0}
            step={1000}
            value={finalPrice}
            onChange={(e) => setFinalPrice(e.target.value)}
            placeholder="π.χ. 145000"
            className="text-right"
            autoFocus
          />

          {discount && Number(discount) > 0 && (
            <p className="text-xs text-orange-600">
              {t('sales.dialogs.sell.discount', { defaultValue: 'Έκπτωση' })}: −{discount}%
            </p>
          )}

          {/* ADR-199: Linked parking/storage appurtenances */}
          {linkedSpaces.hasSpaces && (
            <AppurtenancesSection
              spaces={linkedSpaces.spaces}
              unitPrice={Number(finalPrice) || 0}
              totalAppurtenancesPrice={linkedSpaces.totalAppurtenancesPrice}
              onToggle={linkedSpaces.toggleSpace}
              onPriceChange={linkedSpaces.setSpacePrice}
            />
          )}

          <p className="text-xs text-muted-foreground">
            {t('sales.dialogs.sell.warning', {
              defaultValue: 'Η μονάδα θα μεταβεί σε κατάσταση "Πωλήθηκε" και δεν θα εμφανίζεται πλέον στις διαθέσιμες.',
            })}
          </p>
        </fieldset>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t('common.cancel', { defaultValue: 'Ακύρωση' })}
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !finalPrice || Number(finalPrice) <= 0}
            className="bg-green-600 hover:bg-green-700 text-white"
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

// =============================================================================
// 🏢 4. ΕΠΑΝΑΦΟΡΑ (Revert — cancel sale/reservation)
// =============================================================================

export function RevertDialog({ unit, open, onOpenChange, onSuccess }: BaseDialogProps) {
  const { t } = useTranslation('common');
  const iconSizes = useIconSizes();
  const [saving, setSaving] = useState(false);

  // ADR-199: Linked spaces (appurtenances) — read-only in revert
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
      // ADR-198: Capture deposit before clearing commercial data
      const depositToRefund = unit.commercial?.reservationDeposit ?? 0;
      const refundBuyerContactId = unit.commercial?.buyerContactId ?? null;

      await apiClient.patch(`/api/units/${unit.id}`, {
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

      // ADR-198: Fire-and-forget — πιστωτικό τιμολόγιο
      // Sold → ακύρωση πώλησης: πιστώνεται η ΤΕΛΙΚΗ ΤΙΜΗ (deposit + υπόλοιπο)
      // Reserved → ακύρωση κράτησης: πιστώνεται μόνο η προκαταβολή
      const wasSold = currentStatus === 'sold';
      const creditAmount = wasSold
        ? (unit.commercial?.finalPrice ?? depositToRefund)
        : depositToRefund;
      const creditReason = wasSold ? 'Ακύρωση πώλησης' : 'Ακύρωση κράτησης';

      // ADR-199: Build multi-line credit items if appurtenances exist
      const unitName = unit.name ?? unit.unitName ?? '';
      const lineItems = linkedSpaces.hasSpaces
        ? linkedSpaces.buildLineItems(creditAmount, unitName)
        : undefined;

      if (creditAmount > 0) {
        apiClient.post(`/api/sales/${unit.id}/accounting-event`, {
          eventType: 'credit_invoice',
          unitId: unit.id,
          unitName,
          projectId: unit.project ?? null,
          buyerContactId: refundBuyerContactId,
          buyerName: unit.commercial?.buyerName ?? null,
          projectName: null,
          permitTitle: null,
          companyName: null,
          buildingName: null,
          unitFloor: unit.floor ?? null,
          projectAddress: null,
          paymentMethod: 'bank_transfer',
          notes: null,
          creditAmount,
          reason: creditReason,
          lineItems,
        }).catch((err: unknown) => {
          console.warn('[ADR-198] Credit invoice fire-and-forget failed:', err);
        });
      }

      // ADR-199: Revert appurtenance commercial status
      if (linkedSpaces.hasSpaces) {
        const syncPayload = linkedSpaces.buildSyncPayload('revert');
        if (syncPayload.length > 0) {
          apiClient.post(`/api/sales/${unit.id}/appurtenance-sync`, {
            action: 'revert',
            spaces: syncPayload,
            buyerContactId: null,
            buyerName: null,
          }).catch((err: unknown) => {
            console.warn('[ADR-199] Appurtenance revert sync failed:', err);
          });
        }
      }
    } catch {
      // Error handled by service
    } finally {
      setSaving(false);
    }
  }, [unit, onOpenChange, onSuccess, linkedSpaces]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Undo2 className={`${iconSizes.sm} text-orange-600`} />
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
            <p className="text-sm text-muted-foreground">
              {t('sales.dialogs.revert.buyer', { defaultValue: 'Αγοραστής' })}:{' '}
              <span className="font-medium text-foreground">{unit.commercial.buyerContactId}</span>
            </p>
          )}

          {unit.commercial?.finalPrice && (
            <p className="text-sm text-muted-foreground">
              {t('sales.dialogs.revert.finalPrice', { defaultValue: 'Τιμή πώλησης' })}:{' '}
              <span className="font-medium text-foreground">
                €{unit.commercial.finalPrice.toLocaleString('el-GR')}
              </span>
            </p>
          )}

          {/* ADR-199: Read-only list of linked appurtenances that will be reverted */}
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

          <p className="text-xs text-orange-600 font-medium">
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
            className="bg-orange-600 hover:bg-orange-700 text-white"
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
