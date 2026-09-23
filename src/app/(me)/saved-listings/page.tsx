/**
 * **`/saved-listings` — «οι αγγελίες που κράτησα»** (ADR-777 §8.74).
 *
 * Λεπτή σελίδα: όλη η ουσία ζει στο {@link MySavedListingsContent}, όπως το `/demands` αναθέτει στο
 * `MyDemandsContent` — ένα component δοκιμάζεται· ένα `page.tsx` του App Router όχι.
 *
 * ⚠️ Το κέλυφος (ταυτότητα + `noindex` + κεφαλίδα) το δίνει το `(me)/layout.tsx` — **ποτέ** φρουρός
 * μέσα στη σελίδα (CHECK 3.52).
 *
 * @module app/(me)/saved-listings/page
 */

import { MySavedListingsContent } from '@/components/listings/MySavedListingsContent';

export default function MySavedListingsPage() {
  return <MySavedListingsContent />;
}
