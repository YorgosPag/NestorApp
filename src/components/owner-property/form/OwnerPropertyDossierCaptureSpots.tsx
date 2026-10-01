'use client';

/**
 * 📍🧭 **Τα σημεία λήψης και ο βορράς των κατόψεων στον φάκελο του ιδιώτη** — δήλωση στη φόρμα, δίπλα στο
 * `publishedFileIds` (ADR-897 Φ3 · Φ5.2).
 *
 * 🔑 Ίδιο συμβόλαιο με το σημείο εστίασης (`use-dossier-focal-point-slot`): η δήλωση **δεν** γράφεται αμέσως· μπαίνει στη
 * φόρμα και ταξιδεύει με την **ίδια** αποθήκευση (`updateOwnerProperty` → `republishOwnerProperty`). Μία πράξη
 * «αποθήκευση» για όλες τις ανθρώπινες αποφάσεις της αγγελίας.
 *
 * 🔑 **Μόνο ό,τι φεύγει**: ο φιλοξενούμενος δίνει τα `published` του **ίδιου** επιλογέα με τον γραφέα της βιτρίνας
 * (`publishedDossierFiles`), άρα ο επεξεργαστής δεν προσφέρει ποτέ κάτοψη που ο κόσμος δεν θα δει.
 * ⚠️ Τα bytes στο **προσωπικό** διαμέρισμα: ο φάκελος ανήκει σε άνθρωπο, όχι σε εταιρεία.
 */

import React, { useCallback, useMemo } from 'react';
import { useFormContext } from 'react-hook-form';

import { CaptureSpotControl } from '@/components/listings/capture-spots/CaptureSpotControl';
import { captureSpotMaterialOf } from '@/components/listings/capture-spots/capture-spot-material';
import { captureSurveyWire, readCaptureSurvey, type CaptureSurvey } from '@/lib/listings/capture-survey';
import type { OwnerPropertyFormValues } from '@/lib/owner-property/owner-property-form-values';
import type { PublishedDossierFile } from '@/services/property-dossier/dossier-media-publication';
import type { FileRecord } from '@/types/file-record';

export function OwnerPropertyDossierCaptureSpots({
  published,
}: {
  readonly published: readonly PublishedDossierFile<FileRecord>[];
}): React.ReactElement {
  const form = useFormContext<OwnerPropertyFormValues>();
  const storedSpots = form.watch('publishedFileCaptureSpots');
  const storedNorth = form.watch('publishedFileFloorplanNorth');
  const declared = useMemo(() => readCaptureSurvey(storedSpots, storedNorth), [storedSpots, storedNorth]);
  const material = useMemo(
    () => captureSpotMaterialOf(published.map(({ file, material: kindOf }) => ({ file, kind: kindOf.kind })), 'personal'),
    [published],
  );

  const save = useCallback(
    (next: CaptureSurvey) => {
      // 🧭 ADR-897 Φ5.2 — σημεία **και** βορράς μαζί, στην ίδια πράξη: η αποθήκευση της φόρμας τα παίρνει μαζί ή καθόλου.
      const wire = captureSurveyWire(next);
      form.setValue('publishedFileCaptureSpots', wire.spots, { shouldDirty: true });
      form.setValue('publishedFileFloorplanNorth', wire.north, { shouldDirty: true });
    },
    [form],
  );

  return (
    <CaptureSpotControl photos={material.photos} floorplans={material.floorplans} declared={declared} onSave={save}
      custody="personal" />
  );
}
