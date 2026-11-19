'use client';

/**
 * @fileoverview Η τεμπέλικη **επιφάνεια** «Εκδόσεις εγγράφων» της καρτέλας ακινήτου του ιδιώτη (ADR-945 §7.6 · ADR-744 §27.4).
 * @related OwnerIssuanceRequestSection.tsx (η ενότητα) · OwnerPropertyDetailContent.tsx (ο καταναλωτής)
 * @module components/owner-property/owner-issuance-surfaces
 *
 * Η ενότητα μιλά το λεξιλόγιο του μητρώου εγγράφων (`document-registry` · ετικέτες είδους στο `conveyance`/`legality`) και
 * στήνεται **μόνο** με ανοιχτό `OWNER_ISSUANCE_REQUESTS`. Πίσω από την επιφάνεια: κώδικας **και** κείμενα ως **ένα** αίτημα,
 * έξω από το πρώτο καρέ της καρτέλας (πρότυπο `registry-surfaces.tsx`). Κλειστός διακόπτης ⇒ ούτε κώδικας ούτε κείμενα.
 *
 * ⚠️ Δηλωμένο στο `lazyRouteRegistries` (`scripts/lib/i18n-shell-slice/config.js`) — αλλιώς ο γεννήτορας αρνείται.
 * ⛔ Όχι τοπικό `next/dynamic`: χρέος εισδοχής χωρίς αναμονή (καρέ με ωμά κλειδιά) — το αρνείται ο γεννήτορας.
 */

import { defineLazySurfaces } from '@/utils/lazyRouteFactory';

export const OwnerIssuanceSurfaces = defineLazySurfaces({
  /** «Εκδόσεις εγγράφων»: αίτημα προσφορών σε έως 3 επαγγελματίες του `/pro`, στάδια, επιλογή. */
  OwnerIssuanceRequestSection: {
    load: () =>
      import('@/components/owner-property/OwnerIssuanceRequestSection').then((mod) => ({ default: mod.OwnerIssuanceRequestSection })),
  },
});
