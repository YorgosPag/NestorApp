'use client';

import { useMemo } from 'react';
import { Loader2 } from 'lucide-react';
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
import { PIN_DROP_NO_TEXT_I18N_KEY, type PinDropText } from '../../pin-drop';

export interface AddressDragConfirmDialogProps {
  open: boolean;
  currentAddress: ResolvedAddressFields;
  /**
   * Τι προτείνει η μηχανή για το σημείο αφής.
   *
   * 🔑 ADR-332 D27 Βήμα Β: `not-found` / `unavailable` = **θέση χωρίς κείμενο** (η Google το
   * λέει `ZERO_RESULTS` / «Dropped pin»). Τότε δεν υπάρχει τι να «ενημερωθεί» — μόνο θέση
   * να κρατηθεί. Ως τις 2026-09-10 αυτή η περίπτωση δεν έφτανε **καν** εδώ: το σύρσιμο χανόταν.
   */
  proposal: PinDropText<ResolvedAddressFields>;
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
  proposal,
  onConfirm,
  onCancel,
  onConfirmPositionOnly,
}: AddressDragConfirmDialogProps) {
  const { t } = useTranslation('addresses');
  const proposed = proposal.kind === 'resolved' ? proposal.address : null;

  // Αντικατάσταση, όχι συμφιλίωση: το κενό στο νέο ΣΒΗΝΕΙ — και πρέπει να φαίνεται.
  const conflicts = useMemo(
    () => (proposed ? diffAddressReplacement(currentAddress, proposed) : []),
    [currentAddress, proposed],
  );
  // Χωρίς κείμενο η «μόνο θέση» είναι η ΜΟΝΗ πράξη· με κείμενο, μόνο όταν αυτό διαφέρει
  // (αλλιώς θα ήταν η ίδια πράξη με την «ενημέρωση»).
  const offerPositionOnly = Boolean(onConfirmPositionOnly) && (proposed === null || conflicts.length > 0);
  // Όταν η «ενημέρωση» σβήνει δηλωμένη τιμή — ή δεν υπάρχει καν — το Enter από συνήθεια
  // πρέπει να πέφτει στην ασφαλή επιλογή.
  const focusPositionOnly = offerPositionOnly && (proposed === null || conflicts.some(isClearedField));
  // 🔑 ADR-332 D27 Β13: `pending` = ο διάλογος ανοίγει ΑΜΕΣΩΣ (Google «Dropped pin») και η σύνοψη
  //    εμφανίζεται όταν απαντήσει η μηχανή. «Μόνο η θέση» διαθέσιμο από την πρώτη στιγμή.
  const pending = proposal.kind === 'pending';
  const description = proposal.kind === 'resolved'
    ? t('editor.dragConfirm.description')
    : proposal.kind === 'pending'
      ? t('editor.dragConfirm.pending')
      : t(PIN_DROP_NO_TEXT_I18N_KEY[proposal.kind]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent size="sm" aria-busy={pending}>
        <DialogHeader>
          <DialogTitle>{t('editor.dragConfirm.title')}</DialogTitle>
          <DialogDescription aria-live="polite" className={pending ? 'flex items-center gap-2' : undefined}>
            {pending && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden="true" />}
            {description}
          </DialogDescription>
        </DialogHeader>

        {!pending && proposed === null && offerPositionOnly && (
          <p className="text-sm text-muted-foreground">{t('editor.dragConfirm.noText.keepPosition')}</p>
        )}

        {conflicts.length > 0 && (
          <AddressDiffSummary conflicts={conflicts} className="mt-1" />
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            {t('editor.dragConfirm.cancel')}
          </Button>
          {offerPositionOnly && (
            <Button variant="secondary" autoFocus={focusPositionOnly} onClick={onConfirmPositionOnly}>
              {t('editor.dragConfirm.positionOnly')}
            </Button>
          )}
          {proposed !== null && (
            <Button autoFocus={!focusPositionOnly} onClick={onConfirm}>{t('editor.dragConfirm.confirm')}</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
