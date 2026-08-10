/**
 * **`/demands` — «οι ζητήσεις μου»** (ADR-777 Α9).
 *
 * Λεπτή σελίδα: όλη η ουσία ζει στο {@link MyDemandsContent}, όπως το `(light)/page.tsx`
 * αναθέτει στο `SearchLandingContent`. Ο λόγος είναι ο **έλεγχος**: ένα component
 * δοκιμάζεται· ένα `page.tsx` του App Router όχι.
 *
 * ⚠️ Το κέλυφος (ταυτότητα + `noindex` + κεφαλίδα) το δίνει το `(me)/layout.tsx` —
 * **ποτέ** φρουρός μέσα στη σελίδα (CHECK 3.52 · ADR-777 §8.12).
 *
 * @module app/(me)/demands/page
 */

import { MyDemandsContent } from '@/components/demand/MyDemandsContent';

export default function MyDemandsPage() {
  return <MyDemandsContent />;
}
