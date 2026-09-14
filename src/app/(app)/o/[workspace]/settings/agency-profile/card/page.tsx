/**
 * **`/o/<χώρος>/settings/agency-profile/card` — η επαγγελματική κάρτα της βιτρίνας** (ADR-841 §7 Α21.16).
 *
 * 🔑 **Υποσελίδα της βιτρίνας, και είναι απόφαση**: η κάρτα είναι **δική της πράξη** με δικό της
 * «Αποθήκευση» (τα κανάλια ζουν σε `deny_all` συλλογή), όπως οι ενότητες επεξεργασίας του Google
 * Business Profile. Και η τελευταία σφράγιση i18n της σελίδας της βιτρίνας όρισε ότι η επόμενη
 * αύξηση λύνεται **σπάζοντας την οθόνη σε δεύτερη διαδρομή** — δες `ShowcaseCardDoor`.
 *
 * Λεπτή σελίδα: η ουσία ζει στο {@link ShowcaseCardContent} (ένα component δοκιμάζεται, ένα `page.tsx` όχι).
 * ⚠️ Καμία `useSearchParams` ⇒ καμία ανάγκη ορίου `<Suspense>` (CHECK 3.55).
 *
 * @module app/(app)/o/[workspace]/settings/agency-profile/card/page
 */

import { ShowcaseCardContent } from '@/components/mandate/ShowcaseCardContent';

export default function ShowcaseCardPage() {
  return <ShowcaseCardContent />;
}
