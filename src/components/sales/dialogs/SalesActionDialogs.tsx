'use client';

/**
 * @fileoverview Sales Action Dialogs — ADR-197 §2.9
 * @description 3 dialog components for commercial actions: Change Price, Reserve, Sell
 * @pattern Enterprise dialog pattern with Radix UI primitives
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
import { DollarSign, UserCheck, CheckCircle } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { apiClient } from '@/lib/api/enterprise-api-client';
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
          saleDate: unit.commercial?.saleDate ?? null,
          listedDate: unit.commercial?.listedDate ?? new Date().toISOString(),
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
  const [buyerName, setBuyerName] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await apiClient.patch(`/api/units/${unit.id}`, {
        commercialStatus: 'reserved',
        commercial: {
          askingPrice: unit.commercial?.askingPrice ?? null,
          finalPrice: unit.commercial?.finalPrice ?? null,
          reservationDeposit: deposit ? Number(deposit) : null,
          buyerContactId: buyerName || null,
          saleDate: unit.commercial?.saleDate ?? null,
          listedDate: unit.commercial?.listedDate ?? null,
        },
      } as Record<string, unknown>);
      onOpenChange(false);
      onSuccess?.();
    } catch {
      // Error handled by service
    } finally {
      setSaving(false);
    }
  }, [deposit, buyerName, unit, onOpenChange, onSuccess]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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

        <div className="space-y-3 py-2">
          <fieldset className="space-y-1">
            <Label className="text-sm font-medium">
              {t('sales.dialogs.reserve.buyerName', { defaultValue: 'Όνομα αγοραστή' })}
            </Label>
            <Input
              value={buyerName}
              onChange={(e) => setBuyerName(e.target.value)}
              placeholder={t('sales.dialogs.reserve.buyerPlaceholder', { defaultValue: 'π.χ. Ιωάννης Παπαδόπουλος' })}
              autoFocus
            />
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
        </div>

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
          saleDate: new Date().toISOString(),
          listedDate: unit.commercial?.listedDate ?? null,
        },
      } as Record<string, unknown>);
      onOpenChange(false);
      onSuccess?.();
    } catch {
      // Error handled by service
    } finally {
      setSaving(false);
    }
  }, [finalPrice, unit, onOpenChange, onSuccess]);

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
