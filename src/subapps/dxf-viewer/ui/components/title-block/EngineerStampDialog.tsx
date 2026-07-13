'use client';

/**
 * ADR-651 Φάση Ε — διάλογος **σφραγίδας/υπογραφής μηχανικού**.
 *
 * Ο μηχανικός ανεβάζει **μία φορά** τη σφραγίδα του· μπαίνει αυτόματα στο κελί σφραγίδας κάθε
 * πινακίδας (οθόνη + PDF + DXF). Preview της τρέχουσας + upload (PNG/JPG/WebP) + αφαίρεση.
 *
 * Controlled Radix Dialog, ίδιο μοτίβο με το `PrintDialog`. Το file picker είναι hidden
 * `<input>` μέσα σε `<label>` (μοτίβο `MaterialImagePicker` — accessible, styled ως κουμπί).
 * Καμία hardcoded string (N.11): όλα από `titleBlockStamp.*`.
 *
 * @see ./useEngineerStampUpload.ts — το state του upload/remove
 * @see ../../../app/StampHost.tsx — ο lifecycle owner (EventBus gate)
 */

import * as React from 'react';
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
import { useEngineerStampUpload } from './useEngineerStampUpload';

export interface EngineerStampDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (next: boolean) => void;
}

const ACCEPT = 'image/png,image/jpeg,image/webp';

export function EngineerStampDialog({
  open,
  onOpenChange,
}: EngineerStampDialogProps): React.JSX.Element {
  const { t } = useTranslation('dxf-viewer-shell');
  const { stampUrl, upload, remove, uploading, removing, errorKey } = useEngineerStampUpload();
  const busy = uploading || removing;

  const handleFile = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = ''; // ίδιο αρχείο ξανά ⇒ νέο change event
      if (file) void upload(file);
    },
    [upload],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{t('titleBlockStamp.title')}</DialogTitle>
          <DialogDescription>{t('titleBlockStamp.description')}</DialogDescription>
        </DialogHeader>

        <section className="flex flex-col items-center gap-3 py-2">
          {stampUrl ? (
            <figure className="flex flex-col items-center gap-1">
              {/* eslint-disable-next-line @next/next/no-img-element -- user asset, όχι στατικό */}
              <img
                src={stampUrl}
                alt={t('titleBlockStamp.current')}
                className="max-h-32 max-w-full rounded border border-border bg-white object-contain"
              />
              <figcaption className="text-xs text-muted-foreground">
                {t('titleBlockStamp.current')}
              </figcaption>
            </figure>
          ) : (
            <p className="text-sm text-muted-foreground">{t('titleBlockStamp.empty')}</p>
          )}

          {errorKey && (
            <p role="alert" className="text-sm text-destructive">
              {t(`titleBlockStamp.errors.${errorKey}`)}
            </p>
          )}
        </section>

        <DialogFooter>
          {stampUrl && (
            <Button variant="outline" onClick={() => void remove()} disabled={busy}>
              {removing ? t('titleBlockStamp.removing') : t('titleBlockStamp.remove')}
            </Button>
          )}
          <Button asChild disabled={busy}>
            <label>
              {uploading
                ? t('titleBlockStamp.uploading')
                : stampUrl
                  ? t('titleBlockStamp.replace')
                  : t('titleBlockStamp.upload')}
              <input
                type="file"
                accept={ACCEPT}
                className="hidden"
                onChange={handleFile}
                disabled={busy}
              />
            </label>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
