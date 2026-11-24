'use client';

/**
 * 🏷️ **Η λεζάντα στον φάκελο του ιδιώτη** — δήλωση στη φόρμα, δίπλα στο `publishedFileIds`.
 *
 * 🔑 Ίδιος κύκλος ζωής με το σημείο εστίασης (`use-dossier-focal-point-slot`): η δήλωση **δεν** γράφεται αμέσως· μπαίνει
 * στη φόρμα και ταξιδεύει με την **ίδια** αποθήκευση (`updateOwnerProperty` → `republishOwnerProperty`). Μία πράξη
 * «αποθήκευση» για όλες τις ανθρώπινες αποφάσεις της αγγελίας.
 */

import React, { useCallback } from 'react';
import { useFormContext } from 'react-hook-form';

import { PhotoCaptionControl } from '@/components/listings/photo-caption/PhotoCaptionControl';
import { readDeclaredCaptions, withDeclaredCaption, type PhotoCaption } from '@/lib/listings/photo-caption';
import type { OwnerPropertyFormValues } from '@/lib/owner-property/owner-property-form-values';
import type { PublishableDossierTab } from '@/services/property-dossier/dossier-media-publication';
import type { FileRecord } from '@/types/file-record';

type DossierCaptionSlot = (file: FileRecord, tab: PublishableDossierTab | null) => React.ReactNode;

export function useDossierCaptionSlot(): DossierCaptionSlot {
  const form = useFormContext<OwnerPropertyFormValues>();
  const declared = readDeclaredCaptions(form.watch('publishedFileCaptions'));

  const apply = useCallback(
    (fileId: string, caption: PhotoCaption | null) => {
      // ⚠️ Η **τρέχουσα** τιμή (`getValues`), όχι το `declared` του κλεισίματος — δύο γρήγορες αλλαγές δεν πατιούνται.
      const current = readDeclaredCaptions(form.getValues('publishedFileCaptions'));
      form.setValue('publishedFileCaptions', Object.fromEntries(withDeclaredCaption(current, fileId, caption)), {
        shouldDirty: true,
      });
    },
    [form],
  );

  // Μόνο φωτογραφία: η λεζάντα γράφεται στο `gallery`· η κάτοψη/το τοπογραφικό έχουν δική τους σήμανση.
  return (file, tab) =>
    tab !== 'photos' ? null : (
      <PhotoCaptionControl
        name={file.displayName}
        photo={{ kind: 'file', fileId: file.id, custody: 'personal' }}
        declared={declared.get(file.id) ?? null}
        onApply={(next) => apply(file.id, next)}
      />
    );
}
