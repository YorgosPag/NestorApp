'use client';

/**
 * **Η πύλη της Α8 για την ΠΡΟΣΦΟΡΑ** — το κείμενο, πάνω στον κοινό μηχανισμό.
 *
 * @related ADR-777 §7 (Α8 · Α14 · Α19) · components/shared/DesktopOnlyGate
 * @module components/owner-property/OwnerPropertyCreationGate
 *
 * 🔑 **Ο μηχανισμός είναι ο ΙΔΙΟΣ με τη ζήτηση** (`components/shared/DesktopOnlyGate`):
 * τρία στρώματα, και κανένα δεν είναι `hidden`. Εδώ μένουν τα **δύο** πράγματα που
 * είναι πραγματικά της προσφοράς — η δυναμική εισαγωγή **της δικής της** φόρμας, και
 * το κείμενο.
 *
 * ⚠️ **Το κείμενο ΔΕΝ είναι μετάφραση του κειμένου της ζήτησης.** Ο λόγος που η φόρμα
 * δεν χωράει σε στενή οθόνη είναι **άλλος**: εκεί είναι οι τέσσερις άξονες μαζί, εδώ
 * είναι ότι *«ένα ακίνητο χωρίς πεδία δεν το βρίσκει κανείς»* (§17.1). Ένα κοινό
 * κείμενο θα ήταν σωστό και **κενό**.
 *
 * ⚠️ **Το `ssr: false` δεν είναι βελτιστοποίηση — είναι ορθότητα.** Στον διακομιστή
 * δεν υπάρχει παράθυρο, άρα δεν υπάρχει απάντηση στο «πόσο πλατύ;»· ένα SSR της
 * φόρμας θα έστελνε **σε όλους** ακριβώς ό,τι αυτό το αρχείο υπάρχει για να μη σταλεί.
 */

import React from 'react';
import dynamic from 'next/dynamic';

import { DesktopOnlyGate, DesktopOnlyNotice } from '@/components/shared/DesktopOnlyGate';
import { MY_OFFERS_ROUTE } from '@/lib/owner-property/owner-property-routes';
import type { OwnerPropertyFormContentProps } from './OwnerPropertyFormContent';

/**
 * Η φόρμα, **ζητούμενη κατ' απαίτηση**.
 *
 * ⚠️ Δηλώνεται σε **επίπεδο module** και όχι μέσα στο component: ένα `dynamic()` που
 * τρέχει σε κάθε απόδοση παράγει **νέο** component κάθε φορά, οπότε το React το
 * αποσυναρμολογεί και το ξαναφτιάχνει — και η φόρμα θα έχανε ό,τι έγραψε ο άνθρωπος
 * σε κάθε πάτημα πλήκτρου. **Και εδώ θα έχανε και την ταυτότητα του προσχεδίου**,
 * δηλαδή τα ανεβασμένα αρχεία θα σκορπίζονταν σε φακέλους που κανείς δεν ξαναβρίσκει.
 */
const OwnerPropertyFormContent = dynamic<OwnerPropertyFormContentProps>(
  () =>
    import('./OwnerPropertyFormContent').then((module) => module.OwnerPropertyFormContent),
  { ssr: false },
);

export function OwnerPropertyCreationGate(
  props: OwnerPropertyFormContentProps,
): React.ReactElement {
  return (
    <DesktopOnlyGate
      wide={() => <OwnerPropertyFormContent {...props} />}
      narrow={<DesktopOnlyNotice keyBase="offer" backHref={MY_OFFERS_ROUTE} />}
    />
  );
}
