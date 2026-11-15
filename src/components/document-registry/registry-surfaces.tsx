'use client';

/**
 * @fileoverview Οι τεμπέλικες **επιφάνειες** του μητρώου λήξεων (ADR-915 §41.5 · ADR-744 §27.4 · ADR-280 §11.8 Β4.1).
 * @related RegistryDocCard.tsx (η κάρτα) · RegistryDocSheet.tsx (το πάνελ) · RegistryTable.tsx (η προθέρμανση)
 * @module components/document-registry/registry-surfaces
 *
 * Η πλήρης κάρτα μιας γραμμής (τι σταματά · Εκδίδει · Το φέρνει · ανάθεση · δήλωση στοιχείων) ζει πλέον **μόνο** στο
 * πλαϊνό πάνελ, που ανοίγει από ενέργεια χρήστη ή από σύνδεσμο `?doc=`. Με στατική εισαγωγή όλο αυτό το λεξιλόγιο θα
 * έμπαινε στο πρώτο καρέ (CHECK 3.34: route slice 26.080 > 25.696)· πίσω από την επιφάνεια το πρώτο καρέ κουβαλά μόνο
 * πίνακα και καρτέλες (10.780 bytes). Κώδικας **και** κείμενα ταξιδεύουν ως **ένα** αίτημα (πρότυπο `issuance-surfaces.tsx`).
 *
 * 🏆 **Πέρα από «φόρτωσε στο κλικ»**: η γραμμή καλεί `preload()` με την **πρόθεση** (δείκτης · εστίαση) — πρακτική Remix
 *    `prefetch="intent"` / React Router `route.lazy`, μέσα από τον φορτωτή του μητρώου (CHECK 3.34 κανόνας Ρ). Το πάνελ
 *    ανοίγει γεμάτο· το `import()` δεν κατεβάζει δύο φορές.
 *
 * ⚠️ Δηλωμένο στο `lazyRouteRegistries` (`scripts/lib/i18n-shell-slice/config.js`) — αλλιώς ο γεννήτορας αρνείται.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { defineLazySurfaces } from '@/utils/lazyRouteFactory';
import { REGISTRY_KEYS, REGISTRY_NS } from '@/components/document-registry/document-registry-labels';

/** Όσο φτάνουν κώδικας + κείμενα: ορατή «Φόρτωση…» — ποτέ κενό πάνελ. */
function RegistryDocCardLoading(): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS]);
  return <p role="status" className="m-0 text-sm text-muted-foreground">{t(REGISTRY_KEYS.loading)}</p>;
}

export const RegistrySurfaces = defineLazySurfaces({
  /** Η κάρτα της γραμμής στο πλαϊνό πάνελ (`?doc=`). */
  RegistryDocCard: {
    load: () => import('@/components/document-registry/RegistryDocCard').then((mod) => ({ default: mod.RegistryDocCard })),
    fallback: RegistryDocCardLoading,
  },
});
