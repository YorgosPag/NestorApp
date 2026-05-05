'use client';

import { useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { diffAddressFields } from '../helpers/diffAddressFields';
import { AddressDiffSummary } from './AddressDiffSummary';
import type { ResolvedAddressFields } from '../types';

export interface AddressDragConfirmDialogProps {
  open: boolean;
  currentAddress: ResolvedAddressFields;
  newAddress: ResolvedAddressFields;
  onConfirm: () => void;
  onCancel: () => void;
}

export function AddressDragConfirmDialog({
  open,
  currentAddress,
  newAddress,
  onConfirm,
  onCancel,
}: AddressDragConfirmDialogProps) {
  const { t } = useTranslation('addresses');

  const conflicts = useMemo(
    () => diffAddressFields(currentAddress, newAddress),
    [currentAddress, newAddress],
  );

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{t('editor.dragConfirm.title')}</DialogTitle>
          <DialogDescription>{t('editor.dragConfirm.description')}</DialogDescription>
        </DialogHeader>

        {conflicts.length > 0 && (
          <AddressDiffSummary conflicts={conflicts} className="mt-1" />
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            {t('editor.dragConfirm.cancel')}
          </Button>
          <Button onClick={onConfirm}>{t('editor.dragConfirm.confirm')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
