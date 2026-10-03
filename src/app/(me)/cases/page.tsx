/**
 * **`/cases` — «Οι υποθέσεις μου»** (ADR-901 Φ2 §5.4 · ADR-862 Φ1).
 *
 * Λεπτή σελίδα: η ουσία ζει στο {@link MyCasesContent} (ιδίωμα `(me)/dossiers/page.tsx`).
 *
 * ⚠️ Το κέλυφος (ταυτότητα + `noindex` + κεφαλίδα) το δίνει το `(me)/layout.tsx` — **ποτέ** φρουρός μέσα στη
 * σελίδα (CHECK 3.52). Το τμήμα `cases` είναι δηλωμένο **εκτός** χώρου (`OUTSIDE_WORKSPACE`, CHECK 3.60): ο
 * επαγγελματίας **δεν** είναι μέλος του γραφείου του οικοδεσπότη.
 *
 * @module app/(me)/cases/page
 */

import { MyCasesContent } from '@/components/conveyance/my-cases/MyCasesContent';

export default function MyCasesPage() {
  return <MyCasesContent />;
}
