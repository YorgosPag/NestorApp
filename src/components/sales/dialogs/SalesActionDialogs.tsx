'use client';

/**
 * @fileoverview Sales Action Dialogs — ADR-197 §2.9
 * @description 3 dialog components for commercial actions: Change Price, Reserve, Sell
 * @pattern Enterprise dialog pattern with Radix UI primitives
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
import { DollarSign, UserCheck, CheckCircle, Undo2, UserPlus, AlertTriangle } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { ContactSearchManager } from '@/components/contacts/relationships/ContactSearchManager';
import { TabbedAddNewContactDialog } from '@/components/contacts/dialogs/TabbedAddNewContactDialog';
import { AppurtenancesSection } from './AppurtenancesSection';
import { useLinkedSpacesForSale } from '@/hooks/sales/useLinkedSpacesForSale';
import { useContactEmailWatch } from '@/hooks/sales/useContactEmailWatch';
import { useUnitHierarchyValidation } from '@/hooks/sales/useUnitHierarchyValidation';
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
const logger = createModuleLogger('SalesActionDialogs');
import type { ContactSummary } from '@/components/ui/enterprise-contact-dropdown';
import type { Unit } from '@/types/unit';

// =============================================================================
// 🏢 SERVER ERROR → i18n TRANSLATION MAP
// =============================================================================

/** Maps known server error messages to i18n keys for localized display */
function translateServerError(serverMsg: string, t: (key: string, opts?: Record<string, string>) => string): string {
  const errorMap: Record<string, string> = {
    // Granular hierarchy validation errors
    'Unit is not linked to a building': 'sales.errors.noBuilding',
    'Unit is not linked to a floor': 'sales.errors.noFloor',
    'Building is not linked to a project': 'sales.errors.noProject',
    'Project is not linked to a company': 'sales.errors.noCompany',
    // Legacy (backward compatibility)
    'Unit must be assigned to a building and floor before reservation or sale': 'sales.errors.noFloor',
    'Unit must belong to a project with a company before reservation or sale': 'sales.errors.noCompany',
    // Price & area errors
    'Unit must have an asking price before reservation or sale': 'sales.errors.noAskingPrice',
    'Unit must have area (sqm) before reservation or sale': 'sales.errors.noArea',
    // Buyer errors
    'Buyer contact is required': 'sales.errors.noBuyer',
    'Buyer contact not found': 'sales.errors.buyerNotFound',
    'Service contacts cannot be buyers': 'sales.errors.serviceNotBuyer',
  };

  // Check for exact match
  const i18nKey = errorMap[serverMsg];
  if (i18nKey) return t(i18nKey);

  // Check for partial match (e.g. "Buyer missing required fields: vatNumber")
  if (serverMsg.startsWith('Buyer missing required fields:')) {
    const fields = serverMsg.replace('Buyer missing required fields: ', '');
    return t('sales.errors.buyerMissingFields', { fields });
  }

  // Fallback — return original message
  return serverMsg;
}

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
  const [saveError, setSaveError] = useState<string>('');

  // Real-time email watch — updates live when contact card is edited in another tab
  const { hasEmail: buyerHasEmail } = useContactEmailWatch(buyerContactId);

  // Real-time hierarchy validation — updates live when unit is linked to building/floor
  const hierarchy = useUnitHierarchyValidation(unit, open);

  // Price validation — unit must have an asking price before reservation
  const hasAskingPrice = (unit.commercial?.askingPrice ?? 0) > 0;

  // Area validation — unit must have area (net or gross) before reservation
  const netArea = unit.area ?? 0;
  const grossArea = (unit.areas as Record<string, number> | undefined)?.gross ?? 0;
  const hasArea = netArea > 0 || grossArea > 0;

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
    setSaveError('');
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

      // ADR-198: Fire-and-forget — email + τιμολόγιο
      const depositAmount = Number(deposit);
      const unitName = unit.name ?? unit.unitName ?? '';

      // ADR-199: Build multi-line items if appurtenances selected
      const selectedSpaces = linkedSpaces.getSelectedSpaces();
      const lineItems = selectedSpaces.length > 0
        ? linkedSpaces.buildLineItems(depositAmount, unitName)
        : undefined;

      // 1. ΠΑΝΤΑ: Email κράτησης στον αγοραστή (αν έχει buyerContactId)
      if (buyerContactId) {
        apiClient.post(`/api/sales/${unit.id}/accounting-event`, {
          eventType: 'reservation_notify',
          unitId: unit.id,
          unitName,
          projectId: unit.project ?? null,
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
          logger.warn('Reservation notify fire-and-forget failed', { error: err });
        });
      }

      // 2. ΜΟΝΟ αν deposit > 0: Τιμολόγιο προκαταβολής
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
          logger.warn('Deposit invoice fire-and-forget failed', { error: err });
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
          logger.warn('Appurtenance sync fire-and-forget failed', { error: err });
        });
      }
    } catch (err: unknown) {
      const errorObj = err as { message?: string; error?: string };
      const rawMsg = errorObj?.error ?? errorObj?.message ?? '';
      const msg = rawMsg ? translateServerError(rawMsg, t) : t('common.unknownError', { defaultValue: 'Σφάλμα κατά την κράτηση' });
      setSaveError(msg);
      logger.warn('Reserve failed', { error: rawMsg });
    } finally {
      setSaving(false);
    }
  }, [deposit, buyerContactId, buyerName, unit, onOpenChange, onSuccess, linkedSpaces, t]);

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
              {!buyerContactId && (
                <p className="text-xs text-destructive">
                  {t('sales.dialogs.reserve.buyerRequired', { defaultValue: 'Η επιλογή αγοραστή είναι υποχρεωτική' })}
                </p>
              )}
              {buyerContactId && !buyerHasEmail && (
                <p className="flex items-center gap-1.5 text-xs text-orange-600">
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

          {/* Pre-requisite validations — price and area */}
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

          {/* Real-time hierarchy validation — proactive warnings before submit */}
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
            <Button onClick={handleSave} disabled={saving || !buyerContactId || !hierarchy.isValid || !hasAskingPrice || !hasArea}>
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
  const [saveError, setSaveError] = useState<string>('');

  // Buyer state: initialized from existing commercial data (if reserved → sell flow)
  const existingBuyerId = unit.commercial?.buyerContactId ?? '';
  const existingBuyerName = unit.commercial?.buyerName ?? '';
  const [buyerContactId, setBuyerContactId] = useState<string>(existingBuyerId);
  const [buyerName, setBuyerName] = useState<string>(existingBuyerName);

  // Real-time email watch — updates live when contact card is edited in another tab
  const { hasEmail: buyerHasEmail } = useContactEmailWatch(buyerContactId);

  // Real-time hierarchy validation — updates live when unit is linked to building/floor
  const hierarchy = useUnitHierarchyValidation(unit, open);

  // Area validation — unit must have area (net or gross) before sale
  const sellNetArea = unit.area ?? 0;
  const sellGrossArea = (unit.areas as Record<string, number> | undefined)?.gross ?? 0;
  const sellHasArea = sellNetArea > 0 || sellGrossArea > 0;

  // ADR-199: Linked spaces (appurtenances)
  const linkedSpaces = useLinkedSpacesForSale(unit);

  // ADR-230: Optional broker selection at sale
  const [brokerAgreements, setBrokerAgreements] = useState<BrokerageAgreement[]>([]);
  const [selectedBrokerId, setSelectedBrokerId] = useState<string>('none');

  // Sync state when dialog opens or unit asking price changes
  useEffect(() => {
    if (open) {
      setFinalPrice(unit.commercial?.askingPrice?.toString() ?? '');
      setBuyerContactId(unit.commercial?.buyerContactId ?? '');
      setBuyerName(unit.commercial?.buyerName ?? '');
      setSelectedBrokerId('none');

      // Fetch active brokerage agreements
      BrokerageService.getAgreements(unit.project, unit.id, 'active')
        .then(setBrokerAgreements)
        .catch(() => setBrokerAgreements([]));
    }
  }, [open, unit.commercial?.askingPrice, unit.commercial?.buyerContactId, unit.commercial?.buyerName, unit.project, unit.id]);

  const handleBuyerSelect = useCallback((contact: ContactSummary | null) => {
    setBuyerContactId(contact?.id ?? '');
    setBuyerName(contact?.name ?? '');
  }, []);

  const handleSave = useCallback(async () => {
    const price = Number(finalPrice);
    if (isNaN(price) || price <= 0 || !buyerContactId) return;

    setSaving(true);
    setSaveError('');
    try {
      await apiClient.patch(`/api/units/${unit.id}`, {
        commercialStatus: 'sold',
        commercial: {
          askingPrice: unit.commercial?.askingPrice ?? null,
          finalPrice: price,
          reservationDeposit: unit.commercial?.reservationDeposit ?? null,
          buyerContactId: buyerContactId || null,
          buyerName: buyerName || null,
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
        finalPrice: price,
        depositAlreadyInvoiced: unit.commercial?.reservationDeposit ?? 0,
        lineItems,
      }).catch((err: unknown) => {
        logger.warn('Final sale invoice fire-and-forget failed', { error: err });
      });

      // ADR-230: Fire-and-forget commission recording (if broker selected)
      if (selectedBrokerId !== 'none') {
        const agreement = brokerAgreements.find((a) => a.id === selectedBrokerId);
        if (agreement) {
          BrokerageService.recordCommission(
            {
              brokerageAgreementId: agreement.id,
              agentContactId: agreement.agentContactId,
              agentName: agreement.agentName,
              unitId: unit.id,
              projectId: unit.project,
              buyerContactId: buyerContactId || '',
              salePrice: price,
              commissionType: agreement.commissionType,
              commissionPercentage: agreement.commissionPercentage,
              commissionFixedAmount: agreement.commissionFixedAmount,
            },
            'system'
          ).catch((err: unknown) => {
            logger.warn('Commission recording fire-and-forget failed', { error: err });
          });
        }
      }

      // ADR-199: Sync appurtenance commercial status
      if (selectedSpaces.length > 0) {
        const syncPayload = linkedSpaces.buildSyncPayload('sell');
        apiClient.post(`/api/sales/${unit.id}/appurtenance-sync`, {
          action: 'sell',
          spaces: syncPayload,
          buyerContactId: buyerContactId || null,
          buyerName: buyerName || null,
        }).catch((err: unknown) => {
          logger.warn('Appurtenance sync fire-and-forget failed', { error: err });
        });
      }
    } catch (err: unknown) {
      const errorObj = err as { message?: string; error?: string };
      const rawMsg = errorObj?.error ?? errorObj?.message ?? '';
      const msg = rawMsg ? translateServerError(rawMsg, t) : t('common.unknownError', { defaultValue: 'Σφάλμα κατά την πώληση' });
      setSaveError(msg);
      logger.warn('Sell failed', { error: rawMsg });
    } finally {
      setSaving(false);
    }
  }, [finalPrice, buyerContactId, buyerName, unit, onOpenChange, onSuccess, linkedSpaces, selectedBrokerId, brokerAgreements, t]);

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

        <section className="space-y-3 py-2">
          {/* Buyer selection — read-only if already set from reserve, editable otherwise */}
          <fieldset className="space-y-1">
            {existingBuyerId ? (
              <p className="text-sm">
                <span className="font-medium">{t('sales.dialogs.reserve.buyerName', { defaultValue: 'Αγοραστής' })}:</span>{' '}
                <span className="text-foreground">{buyerName || existingBuyerId}</span>
              </p>
            ) : (
              <>
                <ContactSearchManager
                  selectedContactId={buyerContactId}
                  onContactSelect={handleBuyerSelect}
                  label={t('sales.dialogs.reserve.buyerName', { defaultValue: 'Αγοραστής' })}
                  placeholder={t('sales.dialogs.reserve.buyerPlaceholder', { defaultValue: 'Αναζήτηση επαφής...' })}
                  allowedContactTypes={['individual', 'company']}
                />
                {!buyerContactId && (
                  <p className="text-xs text-destructive">
                    {t('sales.dialogs.reserve.buyerRequired', { defaultValue: 'Η επιλογή αγοραστή είναι υποχρεωτική' })}
                  </p>
                )}
                {buyerContactId && !buyerHasEmail && (
                  <p className="flex items-center gap-1.5 text-xs text-orange-600">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    {t('sales.dialogs.reserve.noEmailWarning', {
                      defaultValue: 'Ο αγοραστής δεν έχει email — δεν θα σταλεί επιβεβαίωση κράτησης. Ενημερώστε την καρτέλα του.',
                    })}
                  </p>
                )}
              </>
            )}
          </fieldset>

          {askingPrice && (
            <p className="text-sm text-muted-foreground">
              {t('sales.dialogs.sell.askingWas', { defaultValue: 'Ζητούμενη τιμή' })}:{' '}
              <span className="font-medium text-foreground">
                {formatCurrency(askingPrice)}
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

          {/* ADR-230: Optional broker selection */}
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
                  <p className="text-xs text-muted-foreground">
                    {t('sales.dialogs.sell.commissionPreview', { defaultValue: 'Προμήθεια' })}:{' '}
                    <span className="font-medium">{formatCurrency(comm)}</span>
                  </p>
                );
              })()}
            </fieldset>
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
        </section>

        {/* Area validation — must have sqm before sale */}
        {!sellHasArea && (
          <aside className="space-y-1.5 rounded-md border border-destructive/30 bg-destructive/5 p-3">
            <p className="flex items-center gap-1.5 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {t('sales.errors.noArea', { defaultValue: 'Η μονάδα δεν έχει εμβαδόν (τ.μ.). Ορίστε καθαρά ή μικτά τ.μ. πριν την πώληση.' })}
            </p>
          </aside>
        )}

        {/* Real-time hierarchy validation — proactive warnings before submit */}
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
            disabled={saving || !finalPrice || Number(finalPrice) <= 0 || !buyerContactId || !hierarchy.isValid || !sellHasArea}
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
          logger.warn('Credit invoice fire-and-forget failed', { error: err });
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
            logger.warn('Appurtenance revert sync failed', { error: err });
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
                {formatCurrency(unit.commercial.finalPrice)}
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
