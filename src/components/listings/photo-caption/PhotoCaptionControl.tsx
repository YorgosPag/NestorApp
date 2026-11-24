'use client';

/**
 * **Το ένα χειριστήριο λεζάντας** — κουμπί + διάλογος, για κάθε επεξεργαστή φωτογραφιών αγγελίας.
 *
 * @related lib/listings/photo-caption · listings/focal-point/PhotoFocalPointControl (το αδελφό χειριστήριο, ίδιο σχήμα)
 *
 * 🔑 **Ίδιο σχήμα με το `PhotoFocalPointControl`**: οι φιλοξενούμενοι διαφέρουν **μόνο** στο πού αποθηκεύεται η δήλωση —
 * γι' αυτό το `onApply` είναι του φιλοξενούμενου και όλα τα άλλα ζουν εδώ. Τα bytes της εικόνας έρχονται από την **ίδια**
 * δήλωση προέλευσης (`use-photo-source`): ο άνθρωπος **βλέπει** την εικόνα που ονομάζει.
 *
 * 🔴 Ο διάλογος είναι **τεμπέλικη επιφάνεια** (`photo-caption-surfaces`, ADR-744 §27): ανοίγει μόνο με κλικ, και φέρνει
 * μαζί του τα κείμενά του — ούτε τα κλειδιά του ούτε οι 26 ετικέτες είδους ταξιδεύουν στο route slice της φόρμας.
 */

import React, { useState } from 'react';
import { Captions } from 'lucide-react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { usePhotoSource, type FocalPointPhoto } from '@/components/listings/focal-point/use-photo-source';
import { LazyPhotoCaptionDialog } from '@/components/shared/media/photo-caption-surfaces';
import type { PhotoCaption } from '@/lib/listings/photo-caption';

const NS = 'property-market';
const K = `${NS}:photoCaption`;

interface PhotoCaptionControlProps {
  /** Το όνομα της φωτογραφίας — για το προσβάσιμο όνομα του κουμπιού και το `alt`. */
  readonly name: string;
  readonly declared: PhotoCaption | null;
  /** `null` ⇒ «χωρίς λεζάντα» (η γραμμή φεύγει από τη δήλωση). */
  readonly onApply: (next: PhotoCaption | null) => void;
  readonly photo: FocalPointPhoto;
  readonly disabled?: boolean;
}

export function PhotoCaptionControl(props: PhotoCaptionControlProps): React.ReactElement {
  const { t } = useTranslation([NS]);
  const [open, setOpen] = useState(false);
  const source = usePhotoSource(open, props.photo);

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
        <Captions aria-hidden="true" />
        {t(`${K}.trigger`)}
        <span className="text-xs text-muted-foreground">
          {t(props.declared === null ? `${K}.stateNone` : `${K}.stateSet`)}
        </span>
      </Button>
      {open && (
        <LazyPhotoCaptionDialog
          open={open}
          onOpenChange={setOpen}
          source={source}
          name={props.name}
          declared={props.declared}
          onApply={props.onApply}
        />
      )}
    </>
  );
}
