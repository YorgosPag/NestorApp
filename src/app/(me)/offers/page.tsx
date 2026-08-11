/**
 * **`/offers` — «τα ακίνητά μου»** (ADR-777 Α14).
 *
 * Λεπτή σελίδα: όλη η ουσία ζει στο {@link MyOwnerPropertiesContent}, όπως το
 * `(me)/demands/page.tsx` αναθέτει στο `MyDemandsContent`. Ο λόγος είναι ο **έλεγχος**:
 * ένα component δοκιμάζεται· ένα `page.tsx` του App Router όχι.
 *
 * ⚠️ Το κέλυφος (ταυτότητα + `noindex` + κεφαλίδα) το δίνει το `(me)/layout.tsx` —
 * **ποτέ** φρουρός μέσα στη σελίδα (CHECK 3.52 · ADR-777 §8.12).
 *
 * 🔑 **`/offers` και όχι `/properties`**: το δεύτερο είναι πιασμένο από το
 * `(app)/properties` — τα route groups δεν εμφανίζονται στη διεύθυνση. Δες
 * `lib/owner-property/owner-property-routes.ts`.
 *
 * @module app/(me)/offers/page
 */

import { MyOwnerPropertiesContent } from '@/components/owner-property/MyOwnerPropertiesContent';

export default function MyOffersPage() {
  return <MyOwnerPropertiesContent />;
}
