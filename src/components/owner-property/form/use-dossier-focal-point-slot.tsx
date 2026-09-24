'use client';

/**
 * 🎯 **Το σημείο εστίασης στον φάκελο του ιδιώτη** — δήλωση στη φόρμα, δίπλα στο `publishedFileIds` (ADR-880).
 *
 * 🔑 Όπως το «δημοσίευση» και το «πρώτη», η δήλωση **δεν** γράφεται αμέσως: μπαίνει στη φόρμα και ταξιδεύει με
 * την **ίδια** αποθήκευση (`updateOwnerProperty` → `republishOwnerProperty`). Μία πράξη «αποθήκευση» για όλες τις
 * ανθρώπινες αποφάσεις της αγγελίας — ποτέ μισή αγγελία αποθηκευμένη.
 *
 * ⚠️ Η πρόταση ζητείται στο **προσωπικό** διαμέρισμα: ο φάκελος ανήκει σε άνθρωπο, όχι σε εταιρεία.
 */

import React, { useCallback } from 'react';
import { useFormContext } from 'react-hook-form';

import { PhotoFocalPointControl } from '@/components/listings/focal-point/PhotoFocalPointControl';
import {
  readDeclaredFocalPoints,
  withDeclaredFocalPoint,
  type PhotoFocalPoint,
} from '@/lib/listings/photo-focal-point';
import type { OwnerPropertyFormValues } from '@/lib/owner-property/owner-property-form-values';
import type { PublishableDossierTab } from '@/services/property-dossier/dossier-media-publication';
import type { FileRecord } from '@/types/file-record';

type DossierFocalPointSlot = (file: FileRecord, tab: PublishableDossierTab | null) => React.ReactNode;

export function useDossierFocalPointSlot(): DossierFocalPointSlot {
  const form = useFormContext<OwnerPropertyFormValues>();
  const declared = readDeclaredFocalPoints(form.watch('publishedFileFocalPoints'));

  const apply = useCallback(
    (fileId: string, point: PhotoFocalPoint | null) => {
      const current = readDeclaredFocalPoints(form.getValues('publishedFileFocalPoints'));
      form.setValue('publishedFileFocalPoints', Object.fromEntries(withDeclaredFocalPoint(current, fileId, point)), {
        shouldDirty: true,
      });
    },
    [form],
  );

  // Μόνο φωτογραφία: η κάτοψη/το τοπογραφικό αποδίδονται ολόκληρα. Τα bytes από τον φρουρούμενο δρόμο του
  // `FileRecord` (διαμέρισμα κατόχου) — ποτέ από το `downloadUrl`.
  return (file, tab) =>
    tab !== 'photos' ? null : (
      <PhotoFocalPointControl
        name={file.displayName}
        photo={{ kind: 'file', fileId: file.id, custody: 'personal' }}
        declared={declared.get(file.id) ?? null}
        onApply={(next) => apply(file.id, next)}
      />
    );
}
