/**
 * **`/messages` — «τα μηνύματά μου»** (ADR-867 Β9β).
 *
 * Λεπτή σελίδα: όλη η ουσία ζει στο {@link NetworkThreadDirectoryContent}, όπως το `(me)/dossiers/page.tsx`
 * αναθέτει στο `MyPropertyDossiersContent` — ένα component δοκιμάζεται· ένα `page.tsx` του App Router όχι.
 *
 * ⚠️ Το κέλυφος (ταυτότητα + `noindex` + κεφαλίδα) το δίνει το `(me)/layout.tsx` — **ποτέ** φρουρός μέσα στη
 * σελίδα (CHECK 3.52). Το τμήμα `messages` είναι δηλωμένο **εκτός** χώρου (`OUTSIDE_WORKSPACE`, CHECK 3.60).
 *
 * 🔑 **Γιατί εδώ και όχι στο γραφείο**: το νήμα είναι `cross-space-thread` — η εμβέλειά του είναι ο
 * **άνθρωπος**, όχι ο χώρος. Ο πλήρης λόγος ζει στην κεφαλίδα του component.
 *
 * ⚠️ Καμία `useSearchParams` ⇒ καμία ανάγκη ορίου `<Suspense>` (CHECK 3.55): ο δρομέας της σελιδοποίησης
 * ζει στη **μνήμη** του hook, ποτέ στο URL — μια διεύθυνση με δρομέα μέσα θα ήταν σελιδοδείκτης που
 * λήγει.
 *
 * @module app/(me)/messages/page
 */

import { NetworkThreadDirectoryContent } from '@/components/network-messaging/NetworkThreadDirectoryContent';

export default function MyMessagesPage() {
  return <NetworkThreadDirectoryContent />;
}
