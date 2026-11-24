'use client';

/**
 * @fileoverview Οι τεμπέλικες **επιφάνειες** της λεζάντας φωτογραφίας (ADR-744 §27 · ADR-280 §11.8 Β4.1).
 * @module components/shared/media/photo-caption-surfaces
 *
 * Δύο επιφάνειες: η **γραμμή του κοινού** (`PhotoCaptionLine`, μόνο όταν η φωτογραφία έχει δηλωμένη λεζάντα) και ο
 * **διάλογος του ανθρώπου** (`PhotoCaptionDialog`, μόνο μετά το κλικ «Λεζάντα»). Στατικά, οι 26 ετικέτες είδους θα
 * έμπαιναν στο slice κάθε σελίδας με φωτογραφίες· με σκέτο `next/dynamic` chunk και κείμενα θα ήταν δύο ανεξάρτητα
 * αιτήματα που η σελίδα δεν περιμένει ⇒ ωμά κλειδιά (χρέος εισδοχής). Εδώ κώδικας και κείμενα ταξιδεύουν ως **ένα**
 * αίτημα· τα namespaces τα λέει ο παραγόμενος χάρτης `lazy-route-namespaces.json`.
 *
 * Λεπτό μητρώο: εισάγει μόνο το factory και τους τύπους των props.
 * ⚠️ Δηλωμένο στο `lazyRouteRegistries` (`scripts/lib/i18n-shell-slice/config.js`) — αλλιώς ο γεννήτορας αρνείται.
 */

import type { ComponentType } from 'react';

import { defineLazySurfaces } from '@/utils/lazyRouteFactory';

// ⚠️ Οι τύποι από αρχείο ΜΟΝΟ-τύπων, ποτέ από τα components: ο γράφος της 3.34 μετρά και το `import type` ως ακμή.
import type { PhotoCaptionDialogProps, PhotoCaptionLineProps } from './photo-caption-surface-props';

export const PhotoCaptionSurfaces = defineLazySurfaces({
  /** Η λεζάντα κάτω από μια φωτογραφία της αγγελίας — χωρίς fallback: μια γραμμή που απλώς αργεί ένα καρέ. */
  PhotoCaptionLine: {
    load: () => import('@/components/shared/media/PhotoCaptionLine'),
  },
  /** Ο διάλογος «Τι δείχνει αυτή η εικόνα;» των επεξεργαστών φωτογραφιών — ανοίγει μόνο με κλικ. */
  PhotoCaptionDialog: {
    load: () => import('@/components/listings/photo-caption/PhotoCaptionDialog'),
  },
});

// Τα components με τα props τους — το εργοστάσιο δέχεται οποιοδήποτε component, εδώ ξαναδένεται ο τύπος.
export const LazyPhotoCaptionLine: ComponentType<PhotoCaptionLineProps> = PhotoCaptionSurfaces.PhotoCaptionLine;
export const LazyPhotoCaptionDialog: ComponentType<PhotoCaptionDialogProps> = PhotoCaptionSurfaces.PhotoCaptionDialog;
