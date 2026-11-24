'use client';

/**
 * @fileoverview **Η λεζάντα μιας φωτογραφίας ως ΚΕΙΜΕΝΟ ΟΘΟΝΗΣ** — η μία μετάφραση `PhotoCaption` → συμβολοσειρά.
 * @related lib/listings/photo-caption (το λεξιλόγιο και ο αναγνώστης) · shared/media/PhotoCaptionLine (η γραμμή του
 *   κοινού) · listings/photo-caption/PhotoCaptionDialog (ο επιλογέας του ανθρώπου)
 * @module components/shared/media/photo-caption-labels
 *
 * 🔑 **ΕΝΑΣ πίνακας ετικετών για δύο οθόνες**: ο επιλογέας στη φόρμα και η γραμμή κάτω από τη φωτογραφία λένε το ίδιο
 * είδος με την **ίδια** λέξη. Δύο πίνακες θα ήταν η μέρα που ο άνθρωπος διαλέγει «Αεροφωτογραφία» και το κοινό διαβάζει
 * κάτι άλλο.
 *
 * 🔴 **ΚΥΡΙΟΛΕΚΤΙΚΑ ΚΛΕΙΔΙΑ, ΠΟΤΕ ΣΥΝΕΝΩΣΗ** *(`` `…subject.${subject}` ``)*: ο γεννήτορας του CHECK 3.34 αρνείται δυναμικό
 * `t()`, και το CHECK 3.8 δεν θα έβλεπε κλειδί που λείπει. Η εξαντλητικότητα έρχεται από το `Record<PhotoSubject, …>`:
 * νέο είδος στο `PHOTO_SUBJECTS` **δεν μεταγλωττίζεται** εδώ μέχρι να πάρει ετικέτα.
 *
 * ⚠️ Όποιος εισάγει αυτό το module σε διαδρομή με route slice, το κάνει **πίσω από `next/dynamic`** — 26 ετικέτες δεν
 * χωρούν στο ταβάνι μιας σελίδας που τις χρειάζεται μόνο όταν υπάρχει λεζάντα.
 */

import { useMemo } from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { PhotoCaption, PhotoSubject } from '@/lib/listings/photo-caption';

const NS = 'listing-detail';

/** Η ετικέτα κάθε είδους, στη γλώσσα του αναγνώστη. */
export function usePhotoSubjectLabels(): Readonly<Record<PhotoSubject, string>> {
  const { t } = useTranslation([NS]);
  return useMemo<Record<PhotoSubject, string>>(() => ({
    exterior: t('listing-detail:media.caption.subject.exterior'),
    plot: t('listing-detail:media.caption.subject.plot'),
    street: t('listing-detail:media.caption.subject.street'),
    surroundings: t('listing-detail:media.caption.subject.surroundings'),
    view: t('listing-detail:media.caption.subject.view'),
    aerial: t('listing-detail:media.caption.subject.aerial'),
    entrance: t('listing-detail:media.caption.subject.entrance'),
    garden: t('listing-detail:media.caption.subject.garden'),
    balcony: t('listing-detail:media.caption.subject.balcony'),
    parking: t('listing-detail:media.caption.subject.parking'),
    pool: t('listing-detail:media.caption.subject.pool'),
    commonAreas: t('listing-detail:media.caption.subject.commonAreas'),
    livingRoom: t('listing-detail:media.caption.subject.livingRoom'),
    kitchen: t('listing-detail:media.caption.subject.kitchen'),
    diningRoom: t('listing-detail:media.caption.subject.diningRoom'),
    bedroom: t('listing-detail:media.caption.subject.bedroom'),
    bathroom: t('listing-detail:media.caption.subject.bathroom'),
    office: t('listing-detail:media.caption.subject.office'),
    hallway: t('listing-detail:media.caption.subject.hallway'),
    storage: t('listing-detail:media.caption.subject.storage'),
    interior: t('listing-detail:media.caption.subject.interior'),
    survey: t('listing-detail:media.caption.subject.survey'),
    cityPlan: t('listing-detail:media.caption.subject.cityPlan'),
    implementationAct: t('listing-detail:media.caption.subject.implementationAct'),
    locationMap: t('listing-detail:media.caption.subject.locationMap'),
    drawing: t('listing-detail:media.caption.subject.drawing'),
  }), [t]);
}

/**
 * **Η λεζάντα όπως διαβάζεται** — «Είδος — κείμενο», ή όποιο από τα δύο υπάρχει. `null` ⇒ καμία λεζάντα ⇒ η οθόνη σιωπά.
 *
 * 🔑 Το κείμενο του ανθρώπου μπαίνει **αυτούσιο** (δεδομένο, όχι διεπαφή)· μόνο το είδος και ο σύνδεσμος μεταφράζονται.
 */
export function usePhotoCaptionText(): (caption: PhotoCaption | null) => string | null {
  const { t } = useTranslation([NS]);
  const labels = usePhotoSubjectLabels();
  return useMemo(() => (caption: PhotoCaption | null): string | null => {
    if (caption === null) return null;
    const subject = caption.subject === null ? null : labels[caption.subject];
    if (subject === null) return caption.text;
    if (caption.text === null) return subject;
    return t('listing-detail:media.caption.joined', { subject, text: caption.text });
  }, [labels, t]);
}
