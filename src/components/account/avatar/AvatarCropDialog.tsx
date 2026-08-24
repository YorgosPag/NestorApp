'use client';

/**
 * Ο διάλογος περικοπής της φωτογραφίας προφίλ (ADR-798 §16).
 *
 * 🏆 **Το μοτίβο είναι αυτό των μεγάλων** — Figma: κυκλική προεπισκόπηση,
 * σύρσιμο για θέση, **ρυθμιστής ζουμ**, «Save image». Δεν εφευρίσκουμε
 * αλληλεπίδραση που κανείς δεν έχει ξαναδεί· εφαρμόζουμε αυτή που όλοι ξέρουν.
 *
 * **Πού πάμε παραπέρα**: (α) η προεπισκόπηση ζωγραφίζεται με τα **ίδια**
 * μαθηματικά που παράγουν το αρχείο ⇒ WYSIWYG *εκ κατασκευής*· (β) το σημείωμα
 * ιδιωτικότητας λέει στον άνθρωπο **τι δεν φεύγει από τη συσκευή του** — η
 * περικοπή γίνεται τοπικά και τα δεδομένα τοποθεσίας της αρχικής εικόνας δεν
 * αποστέλλονται ποτέ, επειδή **ανεβαίνουν μόνο τα pixels που ζωγραφίσαμε**.
 *
 * @module components/account/avatar/AvatarCropDialog
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AVATAR_MAX_ZOOM } from '@/services/profile/avatar-image';
import { AVATAR_PREVIEW_SIZE, type UseAvatarCrop } from './use-avatar-crop';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { COMMON_NAMESPACES } from '@/i18n/namespace-bundles';
import { cn } from '@/lib/utils';

export interface AvatarCropDialogProps {
  readonly open: boolean;
  readonly crop: UseAvatarCrop;
  readonly busy: boolean;
  readonly error: string | null;
  onCancel(): void;
  onApply(): void;
}

export function AvatarCropDialog({ open, crop, busy, error, onCancel, onApply }: AvatarCropDialogProps) {
  const { t } = useTranslation(COMMON_NAMESPACES);

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !busy) onCancel(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('account.profile.photoDialogTitle')}</DialogTitle>
          <DialogDescription>{t('account.profile.photoDialogDescription')}</DialogDescription>
        </DialogHeader>

        <section className="flex flex-col items-center gap-4">
          {/*
            Το `touch-none` είναι λειτουργικό, όχι διακοσμητικό: χωρίς αυτό, το
            σύρσιμο σε οθόνη αφής κάνει **κύλιση της σελίδας** αντί για
            μετακίνηση της εικόνας, και ο άνθρωπος νομίζει ότι το χειριστήριο
            είναι χαλασμένο.
          */}
          <figure
            className="relative overflow-hidden rounded-full border cursor-grab active:cursor-grabbing touch-none"
            style={{ width: AVATAR_PREVIEW_SIZE, height: AVATAR_PREVIEW_SIZE }}
            onPointerDown={crop.onPointerDown}
            onPointerMove={crop.onPointerMove}
            onPointerUp={crop.onPointerUp}
            onPointerCancel={crop.onPointerUp}
          >
            <canvas
              ref={crop.canvasRef}
              role="img"
              aria-label={t('account.profile.photoPreviewLabel')}
              className="block h-full w-full"
            />
          </figure>

          <Slider
            value={[crop.zoom]}
            min={1}
            max={AVATAR_MAX_ZOOM}
            step={0.01}
            onValueChange={([value]) => crop.setZoom(value)}
            thumbAriaLabel={t('account.profile.photoZoom')}
            className="w-full max-w-xs"
            disabled={busy}
          />

          <p className={cn('text-xs text-muted-foreground text-center max-w-sm')}>
            {t('account.profile.photoPrivacyNote')}
          </p>

          {error ? (
            <output role="status" className="text-sm text-destructive text-center">
              {error}
            </output>
          ) : null}
        </section>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            {t('actions.cancel')}
          </Button>
          <Button onClick={onApply} disabled={busy}>
            {busy ? t('account.profile.photoUploading') : t('account.profile.photoApply')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AvatarCropDialog;
