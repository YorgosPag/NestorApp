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
import { useGuardedPropertyMutation } from '@/hooks/useGuardedPropertyMutation';
import { useNotifications } from '@/providers/NotificationProvider';
import { translatePropertyMutationError } from '@/services/property/property-mutation-feedback';

export function ChangePriceDialog({ unit, open, onOpenChange, onSuccess }: BaseDialogProps) {
  const colors = useSemanticColors();
  const { t } = useTranslation(['common', 'common-account', 'common-actions', 'common-empty-states', 'common-navigation', 'common-photos', 'common-sales', 'common-shared', 'common-status', 'common-validation']);
  const iconSizes = useIconSizes();
  const { success, error: notifyError } = useNotifications();
  const [askingPrice, setAskingPrice] = useState<string>(
    unit.commercial?.askingPrice?.toString() ?? ''
  );
  const [saving, setSaving] = useState(false);
  const { checking: previewChecking, runExistingPropertyUpdate, ImpactDialog } = useGuardedPropertyMutation(unit);

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
          listedDate: unit.commercial?.listedDate ?? new Date().toISOString(),
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
          <Label className="text-sm font-medium">
            {t('sales.dialogs.changePrice.askingPrice')}
          </Label>
          <Input
            type="number"
            min={0}
            step={1000}
            value={askingPrice}
            onChange={(e) => setAskingPrice(e.target.value)}
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
            disabled={saving || previewChecking || !askingPrice || Number(askingPrice) <= 0}
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
