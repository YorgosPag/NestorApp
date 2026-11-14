'use client';

/**
 * @fileoverview Οι τεμπέλικες **επιφάνειες** του είδους `document_issuance` (ADR-862 §5.3.11 · ADR-744 §27.4 · ADR-280 §11.8 Β4.1).
 * @module components/conveyance/issuance-surfaces
 *
 * Ο χώρος συνεργασίας έχει **ένα** URL για κάθε είδος υπόθεσης· το είδος το διαλέγει το `kind` της όψης. Η όψη της
 * ανάθεσης έκδοσης δανείζεται το λεξιλόγιο του μητρώου εγγράφων (`document-registry` · `legality` · `property-market`).
 * Με στατική εισαγωγή αυτά τα namespaces έμπαιναν στην κλειστότητα **κάθε** σελίδας υπόθεσης — και της μεταβίβασης,
 * που δεν τα χρειάζεται ποτέ (CHECK 3.34: +14 τριάδες χρέους εισδοχής). Εδώ κώδικας και κείμενα ταξιδεύουν ως **ένα**
 * αίτημα, μόνο όταν η υπόθεση είναι όντως ανάθεση έκδοσης· τα namespaces τα λέει ο παραγόμενος χάρτης
 * `lazy-route-namespaces.json`, όχι χειρόγραφη λίστα (πρακτική Closure/fbt: «τα κείμενα ταξιδεύουν με το chunk»).
 *
 * Λεπτό μητρώο **ανά τομέα**: εισάγει μόνο το factory, άρα δεν προσθέτει τίποτα στη στατική κλειστότητα του εισαγωγέα.
 * ⚠️ Δηλωμένο στο `lazyRouteRegistries` (`scripts/lib/i18n-shell-slice/config.js`) — αλλιώς ο γεννήτορας αρνείται.
 */

import { defineLazySurfaces } from '@/utils/lazyRouteFactory';
import { PageLoadingSpinner } from '@/utils/lazyRouteSkeletons';

export const IssuanceSurfaces = defineLazySurfaces({
  /** Η σελίδα της ανάθεσης στον χώρο του επαγγελματία (`/engagements/[id]` · `/o/<χώρος>/cases/[id]`). */
  EngagedIssuanceContent: {
    load: () => import('@/components/conveyance/my-cases/EngagedIssuanceContent').then(mod => ({ default: mod.EngagedIssuanceContent })),
    fallback: PageLoadingSpinner,
  },
  /** Η κάρτα της ανάθεσης στη λίστα «Οι υποθέσεις μου». */
  MyIssuanceCardView: {
    load: () => import('@/components/conveyance/my-cases/MyIssuanceCardView').then(mod => ({ default: mod.MyIssuanceCardView })),
  },
  /** Τα στοιχεία της ανάθεσης στη σελίδα πρόσκλησης (`/case-invite/[token]`). */
  IssuanceSubjectFacts: {
    load: () => import('@/components/case-invite/IssuanceSubjectFacts').then(mod => ({ default: mod.IssuanceSubjectFacts })),
  },
});
