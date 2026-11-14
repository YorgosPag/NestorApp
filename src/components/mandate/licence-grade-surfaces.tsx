'use client';

/**
 * @fileoverview Η τεμπέλικη **επιφάνεια** των τάξεων μιας άδειας (ADR-915 §40.7 · ADR-744 §27.4).
 * @module components/mandate/licence-grade-surfaces
 *
 * Το πεδίο τάξεων φαίνεται **μόνο** όταν τσεκαριστεί άδεια με `gradeScheme` (σήμερα: ενεργειακός επιθεωρητής). Με
 * στατική εισαγωγή τα κείμενά του θα έμπαιναν στην κλειστότητα της σελίδας «Άδειες» της βιτρίνας και κάθε φόρμας
 * επαφής (CHECK 3.34 Κ2). Εδώ κώδικας και κείμενα ταξιδεύουν ως **ένα** αίτημα, μόνο τότε (πρότυπο `contact-link-surfaces`).
 *
 * ⚠️ Δηλωμένο στο `lazyRouteRegistries` (`scripts/lib/i18n-shell-slice/config.js`) — αλλιώς ο γεννήτορας αρνείται.
 */

import { defineLazySurfaces } from '@/utils/lazyRouteFactory';

export const LicenceGradeSurfaces = defineLazySurfaces({
  /** Οι τάξεις ανά κατηγορία μιας τσεκαρισμένης άδειας με `gradeScheme`. */
  LicenceGradesField: {
    load: () => import('@/components/mandate/LicenceGradesField').then(mod => ({ default: mod.LicenceGradesField })),
  },
});
