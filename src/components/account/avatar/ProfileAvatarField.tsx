'use client';

/**
 * Η φωτογραφία προφίλ στην οθόνη λογαριασμού (ADR-798 §16).
 *
 * Ζει σε **δικό του αρχείο** και όχι μέσα στο `ProfilePageContent`, γιατί έχει
 * δική του κατάσταση (επιλογή αρχείου → αποκωδικοποίηση → περικοπή → ανέβασμα)
 * που δεν αφορά καθόλου τη φόρμα ονομάτων/επαγγέλματος. Ένα πεδίο που κουβαλά
 * τέσσερα βήματα δεν είναι πεδίο φόρμας.
 *
 * ⚠️ **Η ΡΟΗ ΕΙΝΑΙ: ΑΝΕΒΑΣΜΑ → ΜΕΤΑ ΓΡΑΦΗ ΤΟΥ ΔΕΙΚΤΗ.** Ποτέ ανάποδα: ένας
 * δείκτης που γράφτηκε πριν υπάρξουν τα bytes είναι **σπασμένη εικόνα σε κάθε
 * οθόνη**, και το ξεπλένει μόνο νέο ανέβασμα (N.7.2 #2 — καμία συνθήκη αγώνα).
 *
 * @module components/account/avatar/ProfileAvatarField
 */

import React, { useCallback, useRef, useState } from 'react';
import { Camera, Trash2, User as UserIcon } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { COMMON_NAMESPACES } from '@/i18n/namespace-bundles';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import { useTypography } from '@/hooks/useTypography';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import { cn } from '@/lib/design-system';
import { AvatarImageError } from '@/services/profile/avatar-image';
import { decodeAvatarSource, renderAvatar, type AvatarSource } from '@/services/profile/avatar-render';
import {
  isOwnUploadedAvatar,
  removeUserAvatar,
  uploadUserAvatar,
} from '@/services/profile/avatar-upload.service';
import { AVATAR_PREVIEW_SIZE, useAvatarCrop } from './use-avatar-crop';
import { AvatarCropDialog } from './AvatarCropDialog';

/** Οι μορφές που δέχεται ο διάλογος επιλογής — **υπόδειξη**, όχι έλεγχος. */
const ACCEPTED = 'image/png,image/jpeg,image/webp,image/gif,image/avif';

export interface ProfileAvatarFieldProps {
  readonly userId: string | undefined;
  readonly photoURL: string | null | undefined;
  readonly displayName: string;
  updateUserPhoto(photoURL: string | null): Promise<void>;
}

export function ProfileAvatarField({ userId, photoURL, displayName, updateUserPhoto }: ProfileAvatarFieldProps) {
  const { t } = useTranslation(COMMON_NAMESPACES);
  const colors = useSemanticColors();
  const iconSizes = useIconSizes();
  const typography = useTypography();
  const layout = useLayoutClasses();

  const inputRef = useRef<HTMLInputElement | null>(null);
  const [source, setSource] = useState<AvatarSource | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const crop = useAvatarCrop(source?.image ?? null, source ?? null);

  const closeEditor = useCallback(() => {
    setSource((prev) => { prev?.release(); return null; });
    setError(null);
    // Ο διάλογος κλείνει· το input **πρέπει** να καθαριστεί, αλλιώς η επιλογή
    // του **ίδιου** αρχείου δεύτερη φορά δεν πυροδοτεί `change` και η οθόνη
    // φαίνεται «κολλημένη».
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  const onFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      setSource(await decodeAvatarSource(file));
    } catch (err) {
      setError(messageFor(err, t));
      if (inputRef.current) inputRef.current.value = '';
    }
  }, [t]);

  const onApply = useCallback(async () => {
    if (!source || !userId) return;
    setBusy(true);
    setError(null);
    try {
      const rendered = await renderAvatar(source, {
        viewport: AVATAR_PREVIEW_SIZE,
        zoom: crop.zoom,
        offset: crop.offset,
      });
      const url = await uploadUserAvatar({ userId, rendered });
      await updateUserPhoto(url);
      closeEditor();
    } catch (err) {
      setError(messageFor(err, t));
    } finally {
      setBusy(false);
    }
  }, [source, userId, crop.zoom, crop.offset, updateUserPhoto, closeEditor, t]);

  const onRemove = useCallback(async () => {
    if (!userId) return;
    setBusy(true);
    try {
      // Πρώτα ο δείκτης, μετά τα bytes: αν σβήναμε πρώτα τα bytes και η γραφή
      // του δείκτη αποτύγχανε, το `photoURL` θα έδειχνε σε **ανύπαρκτο** object.
      await updateUserPhoto(null);
      await removeUserAvatar(userId);
    } catch (err) {
      setError(messageFor(err, t));
    } finally {
      setBusy(false);
    }
  }, [userId, updateUserPhoto, t]);

  const canRemove = isOwnUploadedAvatar(photoURL, userId ?? '');

  return (
    <section className={layout.flexCenterGap4}>
      <figure className="relative">
        <Avatar className="h-20 w-20">
          {photoURL ? (
            <AvatarImage src={photoURL} alt={displayName} referrerPolicy="no-referrer" />
          ) : null}
          <AvatarFallback className={cn(colors.bg.muted, 'text-2xl')}>
            <UserIcon className={iconSizes.lg} />
          </AvatarFallback>
        </Avatar>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={cn('absolute -bottom-1 -right-1', 'h-8 w-8 rounded-full', colors.bg.primary)}
          aria-label={t('account.profile.changePhoto')}
          disabled={busy || !userId}
          onClick={() => inputRef.current?.click()}
        >
          <Camera className={iconSizes.xs} />
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          className="sr-only"
          tabIndex={-1}
          onChange={onFileChange}
        />
      </figure>

      <div>
        <p className={cn(typography.label.sm, colors.text.primary)}>{displayName}</p>
        <p className={cn(typography.body.sm, colors.text.muted)}>{t('account.profile.photoHint')}</p>
        {canRemove ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-1 h-7 px-2"
            onClick={onRemove}
            disabled={busy}
          >
            <Trash2 className={cn(iconSizes.xs, 'mr-1')} aria-hidden="true" />
            {t('account.profile.photoRemove')}
          </Button>
        ) : null}
        {error && !source ? (
          <output role="status" className={cn(typography.body.xs, colors.text.error, 'block mt-1')}>
            {error}
          </output>
        ) : null}
      </div>

      <AvatarCropDialog
        open={source !== null}
        crop={crop}
        busy={busy}
        error={error}
        onCancel={closeEditor}
        onApply={onApply}
      />
    </section>
  );
}

/** Μεταφράζει το σφάλμα σε **μήνυμα για άνθρωπο** — ποτέ ωμό `err.message`. */
function messageFor(err: unknown, t: (key: string) => string): string {
  if (err instanceof AvatarImageError) {
    switch (err.code) {
      case 'format': return t('account.profile.photoErrorFormat');
      case 'size':   return t('account.profile.photoErrorSize');
      case 'decode': return t('account.profile.photoErrorDecode');
      case 'encode': return t('account.profile.photoErrorEncode');
    }
  }
  return t('account.profile.photoErrorUpload');
}

export default ProfileAvatarField;
