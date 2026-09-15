/**
 * **`/o/<χώρος>/settings/agency-profile/registry` — τα Στοιχεία ΓΕΜΗ της βιτρίνας** (ADR-841 §7 Α23.9 Φέτα Β).
 *
 * 🔑 **Υποσελίδα της βιτρίνας, όπως η κάρτα** (`card/page.tsx`): επαλήθευση, «Υιοθέτηση επωνυμίας ΓΕΜΗ» και ένδειξη
 * κλεισίματος είναι **δική τους** πράξη (Google Business Profile · Stripe), και η σφράγιση του route slice της
 * βιτρίνας ορίζει γραπτά ότι η επόμενη αύξηση λύνεται με δεύτερη διαδρομή.
 *
 * Λεπτή σελίδα: η ουσία ζει στο {@link ShowcaseRegistryContent} (ένα component δοκιμάζεται, ένα `page.tsx` όχι).
 * ⚠️ Καμία `useSearchParams` ⇒ καμία ανάγκη ορίου `<Suspense>` (CHECK 3.55).
 *
 * @module app/(app)/o/[workspace]/settings/agency-profile/registry/page
 */

import { ShowcaseRegistryContent } from '@/components/mandate/ShowcaseRegistryContent';

export default function ShowcaseRegistryPage() {
  return <ShowcaseRegistryContent />;
}
