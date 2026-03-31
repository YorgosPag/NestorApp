'use client';

/**
 * @fileoverview Change Price Dialog — ADR-197 §2.9
 * @description Dialog for updating the asking price of a unit
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
import { DollarSign } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import '@/lib/design-system';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { BaseDialogProps } from './sales-dialog-utils';

export function ChangePriceDialog({ unit, open, onOpenChange, onSuccess }: BaseDialogProps) {
  const colors = useSemanticColors();
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
      await apiClient.patch(API_ROUTES.UNITS.BY_ID(unit.id), {
        commercialStatus: unit.commercialStatus ?? 'for-sale',
        commercial: {
          askingPrice: price,
          finalPrice: unit.commercial?.finalPrice ?? null,
          reservationDeposit: unit.commercial?.reservationDeposit ?? null,
          owners: unit.commercial?.owners ?? null,
          ownerContactIds: unit.commercial?.ownerContactIds ?? null,
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
            <DollarSign className={cn(iconSizes.sm, colors.text.info)} />
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
            placeholder={t('sales.dialogs.changePrice.placeholder', { defaultValue: 'π.χ. 150000' })}
            className="text-right"
            autoFocus
          />
          <p className={cn("text-xs", colors.text.muted)}>
            {t('sales.dialogs.changePrice.hint', {
              defaultValue: 'Η μονάδα θα μπει αυτόματα σε κατάσταση «Προς πώληση»',
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
