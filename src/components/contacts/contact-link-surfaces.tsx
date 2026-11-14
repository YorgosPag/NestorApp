'use client';

/**
 * @fileoverview Οι τεμπέλικες **επιφάνειες** του λογαριασμού πίσω από την επαφή (ADR-915 §40 · ADR-744 §27.4).
 * @module components/contacts/contact-link-surfaces
 *
 * Η γραμμή «Ανέλαβε» δανείζεται το λεξιλόγιο της μεταβίβασης και του μητρώου εγγράφων (`conveyance` ·
 * `document-registry` · `legality` · `property-market`). Με στατική εισαγωγή αυτά θα έμπαιναν στην κλειστότητα **κάθε**
 * σελίδας επαφών (CHECK 3.34: +8 ζεύγη χρέους εισδοχής) — ενώ χρειάζονται **μόνο** όταν η επαφή έχει όντως συνδεδεμένο
 * λογαριασμό. Εδώ κώδικας και κείμενα ταξιδεύουν ως **ένα** αίτημα, μόνο τότε (πρότυπο `issuance-surfaces.tsx`).
 *
 * ⚠️ Δηλωμένο στο `lazyRouteRegistries` (`scripts/lib/i18n-shell-slice/config.js`) — αλλιώς ο γεννήτορας αρνείται.
 */

import { defineLazySurfaces } from '@/utils/lazyRouteFactory';

export const ContactLinkSurfaces = defineLazySurfaces({
  /** Η όψη στην κεφαλίδα της επαφής — μόνο όταν η σύνδεση είναι `linked` ή `offered`. */
  ContactProfessionalLinkBadge: {
    load: () => import('@/components/contacts/details/ContactProfessionalLinkBadge').then(mod => ({ default: mod.ContactProfessionalLinkBadge })),
  },
});
