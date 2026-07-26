'use client';

/**
 * @fileoverview Change Price Dialog — ADR-197 §2.9
 * @description Dialog for updating the asking price of a unit
 */

import { COMMON_NAMESPACES } from '@/i18n/namespace-bundles';
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
import { NumericField } from '@/components/ui/numeric-field';
import { DollarSign } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import '@/lib/design-system';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { BaseDialogProps } from './sales-dialog-utils';
import { useGuardedPropertyMutation } from '@/hooks/useGuardedPropertyMutation';
import { useNotifications } from '@/providers/NotificationProvider';
import { translatePropertyMutationError } from '@/services/property/property-mutation-feedback';
import { nowISO } from '@/lib/date-local';

export function ChangePriceDialog({ unit, open, onOpenChange, onSuccess }: BaseDialogProps) {
  const colors = useSemanticColors();
  const { t } = useTranslation(COMMON_NAMESPACES);
  const iconSizes = useIconSizes();
  const { success, error: notifyError } = useNotifications();
  // ADR-706: the model is a plain number and 0 means "no price yet" — the field
  // renders blank on 0 so the dialog still opens on its placeholder.
  const [askingPrice, setAskingPrice] = useState<number>(unit.commercial?.askingPrice ?? 0);
  const [saving, setSaving] = useState(false);
  const { checking: previewChecking, runExistingPropertyUpdate, ImpactDialog } = useGuardedPropertyMutation(unit);

  // Sync state when dialog opens or unit data changes
  useEffect(() => {
    if (open) {
      setAskingPrice(unit.commercial?.askingPrice ?? 0);
    }
  }, [open, unit.commercial?.askingPrice]);

  const handleSave = useCallback(async () => {
    const price = askingPrice;
    if (price <= 0) return;

    setSaving(true);
    try {
      const updates = {
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
          listedDate: unit.commercial?.listedDate ?? nowISO(),
          transactionChainId: unit.commercial?.transactionChainId ?? null,
        },
      };
      const completed = await runExistingPropertyUpdate(unit, updates as Record<string, unknown>);
      if (!completed) {
        return;
      }
      onOpenChange(false);
      onSuccess?.();
      success(t('viewer.messages.updateSuccess'));
    } catch (error) {
      notifyError(translatePropertyMutationError(error, t));
    } finally {
      setSaving(false);
    }
  }, [askingPrice, notifyError, onOpenChange, onSuccess, runExistingPropertyUpdate, success, t, unit]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className={cn(iconSizes.sm, colors.text.info)} />
            {t('sales.dialogs.changePrice.title')}
          </DialogTitle>
          <DialogDescription>
            {t('sales.dialogs.changePrice.description')}
          </DialogDescription>
        </DialogHeader>

        <fieldset className="space-y-3 py-2">
          <NumericField
            id="change-price-asking"
            label={t('sales.dialogs.changePrice.askingPrice')}
            labelClassName="text-sm font-medium"
            min={0}
            step={1000}
            value={askingPrice}
            onValueChange={setAskingPrice}
            blankValue={0}
            placeholder={t('sales.dialogs.changePrice.placeholder')}
            className="text-right"
            autoFocus
          />
          <p className={cn("text-xs", colors.text.muted)}>
            {t('sales.dialogs.changePrice.hint')}
          </p>
        </fieldset>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || previewChecking || askingPrice <= 0}
          >
            {saving ? t('common.saving') : t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
      </Dialog>
      {ImpactDialog}
    </>
  );
}
