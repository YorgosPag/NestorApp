/**
 * **`/listings/mandates/<ownp>` — Η ΜΙΑ ΕΝΤΟΛΗ** (ADR-841 §7 Α18.12).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΣΤΟ `(app)` — ΤΟ ΙΔΙΟ ΣΥΜΒΟΛΑΙΟ ΜΕ ΤΟΝ ΓΟΝΕΑ ΤΗΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Διαβάζει κατά **`authorCompanyId`**: είναι περιουσία του **γραφείου**, όχι του
 * υπαλλήλου. Το `(me)` δηλώνεται ρητά ως *«ο **ΙΔΙΩΤΙΚΟΣ ΧΩΡΟΣ ΤΟΥ ΙΔΙΩΤΗ**»* στο
 * `.shell-boundary.json`, άρα μια εταιρική οθόνη εκεί θα έκανε τη δήλωση του group να
 * λέει ψέματα — και η δήλωση **είναι** το συμβόλαιο που φυλά η CHECK 3.52.
 *
 * 🔑 **ΤΟ ΔΥΝΑΜΙΚΟ ΤΜΗΜΑ ΔΕΝ ΣΥΓΚΡΟΥΕΤΑΙ ΜΕ ΤΙΣ ΔΥΟ ΑΔΕΛΦΕΣ ΤΟΥ** (`new` ·
 * `requests`): ο δρομολογητής του App Router κρίνει τα **στατικά** τμήματα **πριν** από
 * τα δυναμικά, οπότε εκείνες κρατούν τις διευθύνσεις τους. Το φυλά άγκυρα, όχι μνήμη.
 *
 * Λεπτή σελίδα: όλη η ουσία ζει στο {@link MandateDetailContent}, όπως ο κατάλογος
 * αναθέτει στο `MandateCatalogContent`. Ο λόγος είναι ο **έλεγχος**: ένα component
 * δοκιμάζεται· ένα `page.tsx` του App Router όχι.
 *
 * ⚠️ **Καμία `useSearchParams`, κανένα εχθρικό API** — άρα καμία ανάγκη ορίου
 * `<Suspense>` (CHECK 3.55). Το `params` είναι **Promise** στο Next.js 15 και
 * αναμένεται εδώ, στον διακομιστή· η φόρτωση των δεδομένων γίνεται από τον πελάτη,
 * μετά την προσάρτηση — ίδιο ιδίωμα με τον κατάλογο.
 *
 * @module app/(app)/listings/mandates/[ownerPropertyId]/page
 */

import { MandateDetailContent } from '@/components/mandate/MandateDetailContent';

interface MandateDetailPageProps {
  readonly params: Promise<{ readonly ownerPropertyId: string }>;
}

export default async function MandateDetailPage({ params }: MandateDetailPageProps) {
  const { ownerPropertyId } = await params;
  // ⚠️ **Ωμό, όπως ήρθε.** Ο δρομολογητής έχει ήδη αποκωδικοποιήσει το τμήμα· μια
  //    δεύτερη `decodeURIComponent` εδώ θα έσπαγε κάθε ταυτότητα με `%` (ADR-777 §8.30).
  return <MandateDetailContent ownerPropertyId={ownerPropertyId} />;
}
