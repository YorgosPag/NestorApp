'use client';

/**
 * @fileoverview Η τεμπέλικη **επιφάνεια** του οδηγού «ποιο έγγραφο, από πού» (ADR-949 Α-1 · ADR-744 §27.4).
 * @module components/objective-value/objective-value-evidence-surfaces
 *
 * Ο οδηγός δανείζεται το λεξιλόγιο του μητρώου εγγράφων (`document-registry`: το κουμπί της υπηρεσίας, η διαδρομή
 * μέσα στην πύλη — ADR-915 §43). Με στατική εισαγωγή θα έμπαινε στην κλειστότητα του δημόσιου υπολογιστή (CHECK 3.34:
 * +1 ζεύγος χρέους εισδοχής, ο γεννήτορας το αρνήθηκε 2026-11-22) — ενώ χρειάζεται **μόνο** όσο κάτι λείπει, κάτω από
 * το αποτέλεσμα. Εδώ κώδικας και κείμενα ταξιδεύουν ως **ένα** αίτημα, μόνο τότε (πρότυπο `contact-link-surfaces.tsx`).
 *
 * ⚠️ Δηλωμένο στο `lazyRouteRegistries` (`scripts/lib/i18n-shell-slice/config.js`) — αλλιώς ο γεννήτορας αρνείται.
 */

import { defineLazySurfaces } from '@/utils/lazyRouteFactory';

export const ObjectiveValueEvidenceSurfaces = defineLazySurfaces({
  /** Κάτω από το αποτέλεσμα, μόνο όταν η μηχανή λέει ότι κάτι λείπει. */
  ObjectiveValueEvidenceGuide: {
    load: () => import('@/components/objective-value/ObjectiveValueEvidenceGuide').then(mod => ({ default: mod.ObjectiveValueEvidenceGuide })),
  },
});
