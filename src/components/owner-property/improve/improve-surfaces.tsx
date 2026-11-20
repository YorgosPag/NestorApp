'use client';

/**
 * @fileoverview Οι τεμπέλικες **επιφάνειες** της «Βελτίωσε την αγγελία σου» (ADR-946 · ADR-842 Φ4 · ADR-744 §27.4).
 * @module components/owner-property/improve/improve-surfaces
 *
 * Η προεπισκόπηση «τι βλέπει ο αγοραστής» ΕΙΝΑΙ τα components της σελίδας αγγελίας (`ListingPriceBlock` ·
 * `ListingEnergyCertificate`), με το λεξιλόγιό τους (`listing-detail` · `search-results`). Με στατική εισαγωγή αυτά
 * έμπαιναν στο slice της διαδρομής (μετρημένο **19,8 → 28,8 KB**) και στην αναμονή της πρώτης απόδοσης — ενώ η φόρμα
 * δεν τα χρειάζεται για να ζωγραφίσει. Εδώ κώδικας και κείμενα ταξιδεύουν ως **ένα** αίτημα· τα namespaces τα λέει ο
 * παραγόμενος χάρτης `lazy-route-namespaces.json`, όχι χειρόγραφη λίστα.
 *
 * Λεπτό μητρώο: εισάγει μόνο το factory και τη μία πρόταση αναμονής.
 * ⚠️ Δηλωμένο στο `lazyRouteRegistries` (`scripts/lib/i18n-shell-slice/config.js`) — αλλιώς ο γεννήτορας αρνείται.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { defineLazySurfaces } from '@/utils/lazyRouteFactory';

/** Όσο φτάνουν κώδικας και κείμενα — μία πρόταση κατάστασης, ποτέ κενό. */
export function BuyerPreviewPending() {
  const { t } = useTranslation(['objective-value']);
  return <p role="status" className="m-0 text-sm text-muted-foreground">{t('objective-value:improve.aside.loading')}</p>;
}

export const ImproveSurfaces = defineLazySurfaces({
  /** Η αγγελία του αγοραστή στο πλαϊνό της «Βελτίωσε» (`/offers/[offerId]/improve`). */
  OwnerListingBuyerPreview: {
    load: () =>
      import('@/components/owner-property/improve/OwnerListingBuyerPreview').then((mod) => ({
        default: mod.OwnerListingBuyerPreview,
      })),
    fallback: BuyerPreviewPending,
  },
});
