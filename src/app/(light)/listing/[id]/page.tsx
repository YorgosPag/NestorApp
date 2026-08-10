/**
 * `/listing/[id]` — **η οθόνη 3** (ADR-777 Α3, τρίτη γραμμή του πίνακα τριών οθονών).
 *
 * Ζει στο **ίδιο** route group `(light)` με τις οθόνες 1 και 2: ο επισκέπτης είναι
 * **ανώνυμος** — χωρίς sidebar, χωρίς πελάτη, χωρίς λογαριασμό. Το κέλυφος αποκτά τον
 * **τρίτο** καταναλωτή του αντί να γεννηθεί τέταρτο (N.0.2).
 *
 * ⚠️ **`Suspense` υποχρεωτικά** — για τον **ίδιο** λόγο με το `search/results/page.tsx`
 * και **όχι** για τον ίδιο με το `search/page.tsx`: το περιεχόμενο διαβάζει τη
 * διεύθυνση (`useSearchParams`, για να κρατήσει τα φίλτρα της επιστροφής), και χωρίς
 * όριο αναστολής ολόκληρη η διαδρομή βγαίνει από τη στατική απόδοση.
 *
 * ⚠️ **Το `params` είναι `Promise` (Next 15)** — ίδιο ιδίωμα με `buildings/[id]`. Ένα
 * συγχρονισμένο `params.id` εδώ θα μεταγλωττιζόταν και θα έσπαγε **στην εκτέλεση**.
 *
 * 🔶 **ΔΗΛΩΜΕΝΟ ΟΡΙΟ, με όνομα:** καμία `generateMetadata`, καμία απόδοση στον
 * διακομιστή του **περιεχομένου** της αγγελίας. Και οι τρεις δημόσιες οθόνες
 * διαβάζουν από τον **πελάτη** (Firestore SDK, `read: if true`). Μια ανάγνωση εδώ θα
 * απαιτούσε **Admin SDK**, δηλαδή **δεύτερο αναγνώστη** της ίδιας προβολής με
 * διαφορετικά δικαιώματα — ακριβώς το σχήμα που το ADR-749 ονομάζει «δύο μηχανές, μία
 * ερώτηση». Είναι πραγματικό κενό (SEO για portal ακινήτων **μετράει**) και ανήκει σε
 * **δική του απόφαση**, όχι σε πλάγια είσοδο από μια σελίδα. Γραμμένο στο ADR-777 §8.11.
 */

import React, { Suspense } from 'react';
import { StaticPageLoading } from '@/core/states';
import { ListingDetailContent } from '@/components/listing-detail/ListingDetailContent';

interface ListingDetailPageProps {
  readonly params: Promise<{ readonly id: string }>;
}

export default async function ListingDetailPage({ params }: ListingDetailPageProps) {
  const { id } = await params;

  return (
    <Suspense fallback={<StaticPageLoading />}>
      <ListingDetailContent id={id} />
    </Suspense>
  );
}
