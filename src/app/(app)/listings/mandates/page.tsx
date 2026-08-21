/**
 * **`/listings/mandates` — ο κατάλογος εντολών του γραφείου** (ADR-777 §8.34).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΣΤΟ `(app)` — ΤΟ ΙΔΙΟ ΣΥΜΒΟΛΑΙΟ ΜΕ ΤΗΝ ΠΟΡΤΑ ΤΟΥ ΔΙΠΛΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο κατάλογος διαβάζει κατά **`authorCompanyId`**: είναι περιουσία του **γραφείου**,
 * όχι του υπαλλήλου. Το `(me)` δηλώνεται ρητά ως *«ο **ΙΔΙΩΤΙΚΟΣ ΧΩΡΟΣ ΤΟΥ ΙΔΙΩΤΗ**»*
 * στο `.shell-boundary.json`, άρα μια εταιρική οθόνη εκεί θα έκανε τη δήλωση του group
 * να λέει ψέματα — και η δήλωση **είναι** το συμβόλαιο που φυλά η CHECK 3.52.
 *
 * Λεπτή σελίδα: όλη η ουσία ζει στο {@link MandateCatalogContent}, όπως το
 * `new/page.tsx` αναθέτει στο `BrokeredListingPageContent`. Ο λόγος είναι ο
 * **έλεγχος**: ένα component δοκιμάζεται· ένα `page.tsx` του App Router όχι.
 *
 * ⚠️ **Καμία `useSearchParams`, κανένα εχθρικό API** — άρα καμία ανάγκη ορίου
 * `<Suspense>` (CHECK 3.55). Η φόρτωση γίνεται από τον πελάτη, μετά την προσάρτηση.
 *
 * @module app/(app)/listings/mandates/page
 */

import { MandateCatalogContent } from '@/components/mandate/MandateCatalogContent';

export default function MandateCatalogPage() {
  return <MandateCatalogContent />;
}
