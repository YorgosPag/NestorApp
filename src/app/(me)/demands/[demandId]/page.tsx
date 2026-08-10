/**
 * **`/demands/[demandId]` — μία ζήτηση, και η απάντηση του §12.6.**
 *
 * ⚠️ **Το `params` είναι `Promise` (Next 15)** — ίδιο ιδίωμα με `listing/[id]`. Ένα
 * συγχρονισμένο `params.demandId` εδώ θα **μεταγλωττιζόταν** και θα έσπαγε στην
 * εκτέλεση.
 *
 * 🔑 **Καμία `generateMetadata`, και εδώ ΔΕΝ είναι κενό — είναι απαίτηση.** Το
 * `(me)/layout.tsx` δηλώνει `robots: noindex` για **όλο** το group: το περιεχόμενο
 * είναι **επίπεδο Β** (αυστηρά ιδιωτικό ανά χρήστη), και μια ευρετηριασμένη λίστα
 * ταυτοτήτων ζήτησης είναι αφετηρία για ακριβώς το «εργαλείο πίεσης» που απαγορεύει
 * το SPEC-777B §12.7(α).
 *
 * ⚠️ **Κανένα `Suspense`**: σε αντίθεση με τη σελίδα αγγελίας, εδώ **δεν** διαβάζεται
 * η διεύθυνση με `useSearchParams` — η ταυτότητα έρχεται από το δυναμικό τμήμα. Ένα
 * όριο αναστολής χωρίς αναστέλλοντα καταναλωτή θα ήταν φρουρός χωρίς απόδειξη ζωής.
 *
 * @module app/(me)/demands/[demandId]/page
 */

import { DemandDetailContent } from '@/components/demand/DemandDetailContent';

interface DemandDetailPageProps {
  readonly params: Promise<{ readonly demandId: string }>;
}

export default async function DemandDetailPage({ params }: DemandDetailPageProps) {
  const { demandId } = await params;

  return <DemandDetailContent demandId={demandId} />;
}
