/**
 * **`/interest-check` — «Δες αν κάποιος ενδιαφέρεται για το ακίνητό σου»** (ADR-900).
 *
 * Λεπτή σελίδα: όλη η ουσία ζει στο {@link InterestCheckContent}, όπως το `/demands` αναθέτει στο
 * `MyDemandsContent` — ένα component δοκιμάζεται, ένα `page.tsx` του App Router όχι.
 *
 * ⚠️ Το κέλυφος (ταυτότητα + `noindex` + κεφαλίδα) το δίνει το `(me)/layout.tsx` — **ποτέ** φρουρός
 * μέσα στη σελίδα (CHECK 3.52). Η ταυτότητα χρειάζεται: η διαδρομή του API τη ζητά για λογοδοσία και
 * όριο ρυθμού.
 *
 * @module app/(me)/interest-check/page
 */

import { InterestCheckContent } from '@/components/demand/interest-check/InterestCheckContent';

export default function InterestCheckPage() {
  return <InterestCheckContent />;
}
