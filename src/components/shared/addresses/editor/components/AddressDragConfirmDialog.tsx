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
import { diffAddressReplacement, isClearedField } from '../helpers/diffAddressFields';
import { AddressDiffSummary } from './AddressDiffSummary';
import type { ResolvedAddressFields } from '../types';

export interface AddressDragConfirmDialogProps {
  open: boolean;
  currentAddress: ResolvedAddressFields;
  newAddress: ResolvedAddressFields;
  onConfirm: () => void;
  onCancel: () => void;
  /**
   * «Μόνο η θέση»: μετακινεί την πινέζα και **κρατά** το κείμενο που δήλωσε ο άνθρωπος.
   *
   * 🔑 Χωρίς αυτό, το σύρσιμο ήταν δίλημμα: για να διορθώσεις την πινέζα σε δρόμο που
   * το OSM ξέρει χωρίς αριθμούς, έπρεπε να **θυσιάσεις τον αριθμό** («Σαμοθράκης 16» →
   * «Σαμοθράκης»). Προαιρετικό — εμφανίζεται μόνο όπου ο καλών μπορεί να το τιμήσει.
   */
  onConfirmPositionOnly?: () => void;
}

export function AddressDragConfirmDialog({
  open,
  currentAddress,
  newAddress,
  onConfirm,
  onCancel,
  onConfirmPositionOnly,
}: AddressDragConfirmDialogProps) {
  const { t } = useTranslation('addresses');

  // Αντικατάσταση, όχι συμφιλίωση: το κενό στο νέο ΣΒΗΝΕΙ — και πρέπει να φαίνεται.
  const conflicts = useMemo(
    () => diffAddressReplacement(currentAddress, newAddress),
    [currentAddress, newAddress],
  );
  // Όταν η «ενημέρωση» σβήνει δηλωμένη τιμή, το Enter από συνήθεια πρέπει να μην τη χάνει.
  const focusPositionOnly = Boolean(onConfirmPositionOnly) && conflicts.some(isClearedField);

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
          {/* Χωρίς αλλαγή κειμένου, «μόνο θέση» και «ενημέρωση» είναι η ίδια πράξη. Το
              σβήσιμο ΜΕΤΡΑ πλέον ως αλλαγή (`diffAddressReplacement`, άγκυρα Δ1). */}
          {onConfirmPositionOnly && conflicts.length > 0 && (
            <Button variant="secondary" autoFocus={focusPositionOnly} onClick={onConfirmPositionOnly}>
              {t('editor.dragConfirm.positionOnly')}
            </Button>
          )}
          <Button autoFocus={!focusPositionOnly} onClick={onConfirm}>{t('editor.dragConfirm.confirm')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
