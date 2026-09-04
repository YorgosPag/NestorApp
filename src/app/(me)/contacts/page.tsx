/**
 * **`/contacts` — «οι επαφές μου»** (ADR-843 §10).
 *
 * Λεπτή σελίδα: όλη η ουσία ζει στο {@link MyContactsContent}, ίδιο ιδίωμα με το
 * `(me)/demands/page.tsx` → `MyDemandsContent`. Ο λόγος είναι ο **έλεγχος**: ένα
 * component δοκιμάζεται· ένα `page.tsx` του App Router όχι.
 *
 * ⚠️ Το κέλυφος (ταυτότητα + `noindex` + κεφαλίδα) το δίνει το `(me)/layout.tsx` —
 * **ποτέ** φρουρός μέσα στη σελίδα (CHECK 3.52 · ADR-777 §8.12).
 *
 * @module app/(me)/contacts/page
 */

import { MyContactsContent } from '@/components/contact/MyContactsContent';

export default function MyContactsPage() {
  return <MyContactsContent />;
}
