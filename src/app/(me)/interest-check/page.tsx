/**
 * **`/interest-check` — «Δες αν κάποιος ενδιαφέρεται για το ακίνητό σου»** (ADR-900).
 *
 * Λεπτή σελίδα: όλη η ουσία ζει στο {@link InterestCheckContent}, όπως το `/demands` αναθέτει στο
 * `MyDemandsContent` — ένα component δοκιμάζεται, ένα `page.tsx` του App Router όχι.
 *
 * ⚠️ Το κέλυφος (ταυτότητα + `noindex` + κεφαλίδα) το δίνει το `(me)/layout.tsx` — **ποτέ** φρουρός
 * μέσα στη σελίδα (CHECK 3.52). Η ταυτότητα χρειάζεται: η διαδρομή του API τη ζητά για λογοδοσία και
 * όριο ρυθμού.
 *
 * 🔑 **Η διεύθυνση από τις δημόσιες πόρτες** (αρχική, ADR-900 §3.7) φτάνει ως `?address=` — ίδιο σχήμα
 * με το `/offers/new`: η σελίδα διαβάζει το ερώτημα στον διακομιστή και δίνει **αρχική τιμή**. Ο ανώνυμος
 * περνά από τη σύνδεση **με επιστροφή** (`ProtectedRoute` → `loginHref`), άρα η διεύθυνση επιβιώνει.
 *
 * @module app/(me)/interest-check/page
 */

import { InterestCheckContent } from '@/components/demand/interest-check/InterestCheckContent';
import { prospectAddressOf } from '@/lib/demand/prospect-interest';
import { urlSearchParamsOf, type PageSearchParams } from '@/lib/routes/page-search-params';

interface InterestCheckPageProps {
  readonly searchParams: Promise<PageSearchParams>;
}

export default async function InterestCheckPage({ searchParams }: InterestCheckPageProps) {
  const params = urlSearchParamsOf(await searchParams);
  return <InterestCheckContent initialAddress={prospectAddressOf(params)} />;
}
