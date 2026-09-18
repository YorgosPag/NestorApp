/**
 * **`/dossiers` — «οι φάκελοί μου»** (ADR-866 Φ1.2).
 *
 * Λεπτή σελίδα: όλη η ουσία ζει στο {@link MyPropertyDossiersContent}, όπως το `(me)/offers/page.tsx` αναθέτει
 * στο `MyOwnerPropertiesContent` — ένα component δοκιμάζεται· ένα `page.tsx` του App Router όχι.
 *
 * ⚠️ Το κέλυφος (ταυτότητα + `noindex` + κεφαλίδα + ειδοποιήσεις) το δίνει το `(me)/layout.tsx` — **ποτέ** φρουρός
 * μέσα στη σελίδα (CHECK 3.52). Το τμήμα `dossiers` είναι δηλωμένο **εκτός** χώρου (`OUTSIDE_WORKSPACE`, CHECK 3.60).
 *
 * @module app/(me)/dossiers/page
 */

import { MyPropertyDossiersContent } from '@/components/property-dossier/MyPropertyDossiersContent';

export default function MyDossiersPage() {
  return <MyPropertyDossiersContent />;
}
