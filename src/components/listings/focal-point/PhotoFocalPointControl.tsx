'use client';

/**
 * **Το ένα χειριστήριο σημείου εστίασης** — κουμπί + διάλογος + πρόταση, για **κάθε** επεξεργαστή (ADR-880).
 *
 * 🔑 **Τρεις φιλοξενούμενοι, ένα component** (N.0.2): γραφείο (`ListingMediaOrderPanel`), φάκελος ιδιώτη
 * (`OwnerPropertyDossierItem`), παλιό `media[]` (`OwnerPropertyMediaItem`). Διαφέρουν **μόνο** στο πού
 * αποθηκεύεται η δήλωση — γι' αυτό το `onApply` είναι του φιλοξενούμενου και όλα τα άλλα ζουν εδώ.
 *
 * 🔑 **Μία δήλωση προέλευσης** (`photo`): από αυτήν βγαίνουν **και** τα bytes **και** η πρόταση του διακομιστή —
 * δύο χωριστά props θα μπορούσαν να δείχνουν σε διαφορετικά αρχεία. Βλ. `use-photo-source`.
 */

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { Crosshair } from 'lucide-react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import type { PhotoFocalPoint } from '@/lib/listings/photo-focal-point';
import { useFocalPointSuggestion, type FocalPointSuggestionTarget } from './use-focal-point-suggestion';
import { usePhotoSource, type FocalPointPhoto } from './use-photo-source';

const NS = 'property-market';
const K = `${NS}:photoFocalPoint`;

/**
 * 🔴 **ΟΡΙΟ `next/dynamic` (CHECK 3.34 Κ2, ADR-744)**: ο διάλογος ανοίγει **μόνο με κλικ** — δεν ζωγραφίζεται
 * στο πρώτο καρέ, άρα τα κλειδιά του δεν χρειάζεται να ταξιδεύουν στο route slice. Χωρίς το όριο, τα
 * `/o/[workspace]/listings/mandates/new` (20.848 > 19.860) και `/offers/[offerId]` (31.715 > 31.056)
 * ξεπερνούσαν το ταβάνι τους. Ίδιο σχήμα με το `CoverageReachNotice` στο `OwnerPropertyPlaceField`.
 */
const PhotoFocalPointDialog = dynamic(
  () => import('./PhotoFocalPointDialog').then((m) => m.PhotoFocalPointDialog),
  { ssr: false },
);

interface PhotoFocalPointControlProps {
  /** Το όνομα της φωτογραφίας — για το προσβάσιμο όνομα του κουμπιού και το `alt`. */
  readonly name: string;
  readonly declared: PhotoFocalPoint | null;
  readonly onApply: (next: PhotoFocalPoint | null) => void;
  /** Από πού διαβάζεται η φωτογραφία — `file` (με πρόταση διακομιστή) ή `storage` (παλιό `media[]`). */
  readonly photo: FocalPointPhoto;
  readonly disabled?: boolean;
}

/** Πρόταση υπάρχει μόνο όπου υπάρχει `FileRecord` — το παλιό `media[]` την παίρνει στο ράφι. */
const suggestionTargetOf = (photo: FocalPointPhoto): FocalPointSuggestionTarget | null =>
  photo.kind === 'file' ? { fileId: photo.fileId, custody: photo.custody } : null;

export function PhotoFocalPointControl(props: PhotoFocalPointControlProps): React.ReactElement {
  const { t } = useTranslation([NS]);
  const [open, setOpen] = useState(false);
  const source = usePhotoSource(open, props.photo);
  const suggestion = useFocalPointSuggestion(suggestionTargetOf(props.photo), open);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={props.disabled}
        aria-label={t(`${K}.triggerAria`, { name: props.name })}
        onClick={() => setOpen(true)}
      >
        <Crosshair aria-hidden="true" />
        {t(`${K}.trigger`)}
        <span className="text-xs text-muted-foreground">
          {t(props.declared === null ? `${K}.stateAuto` : `${K}.stateManual`)}
        </span>
      </Button>
      <PhotoFocalPointDialog
        open={open}
        onOpenChange={setOpen}
        source={source}
        name={props.name}
        declared={props.declared}
        suggestion={suggestion}
        onApply={props.onApply}
      />
    </>
  );
}
