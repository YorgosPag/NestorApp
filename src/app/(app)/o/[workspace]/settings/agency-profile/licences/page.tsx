/**
 * **`/o/<χώρος>/settings/agency-profile/licences` — οι άδειες της βιτρίνας** (ADR-915 §21).
 *
 * 🔑 **Υποσελίδα της βιτρίνας, όπως η κάρτα και τα Στοιχεία ΓΕΜΗ**: οι άδειες (π.χ. ενεργειακός επιθεωρητής ΥΠΕΝ) είναι
 * **δική τους** πράξη (LinkedIn «Licenses & certifications»), και η σφράγιση του route slice της βιτρίνας ορίζει γραπτά
 * ότι η επόμενη αύξηση λύνεται με δεύτερη διαδρομή.
 *
 * Λεπτή σελίδα: η ουσία ζει στο {@link ShowcaseLicencesContent} (ένα component δοκιμάζεται, ένα `page.tsx` όχι).
 * ⚠️ Καμία `useSearchParams` ⇒ καμία ανάγκη ορίου `<Suspense>` (CHECK 3.55).
 *
 * @module app/(app)/o/[workspace]/settings/agency-profile/licences/page
 */

import { ShowcaseLicencesContent } from '@/components/mandate/ShowcaseLicencesContent';

export default function ShowcaseLicencesPage() {
  return <ShowcaseLicencesContent />;
}
