/**
 * `/properties/[id]` — **Η ΚΑΡΤΕΛΑ ΕΝΟΣ ΑΚΙΝΗΤΟΥ** (ADR-777 §8.30).
 *
 * 🔴 **ΗΤΑΝ ΑΝΑΚΑΤΕΥΘΥΝΣΗ, ΚΑΙ Η ΑΝΑΚΑΤΕΥΘΥΝΣΗ ΗΤΑΝ ΤΟ ΕΛΑΤΤΩΜΑ.** Έστελνε σε
 * `/properties?propertyId=…`, δηλαδή σε σελίδα που **αγνοεί** την παράμετρο
 * (διάβαζε μόνο `?view`), ενώ η σελίδα που την **τιμά** ήταν μία διαδρομή δίπλα
 * (`/spaces/properties`). Δύο συμβάσεις που δεν συναντήθηκαν ποτέ (ADR-749) — και
 * το σχόλιο που ζούσε εδώ ονόμαζε **τρεις** καταναλωτές σαν να δουλεύουν.
 *
 * ⚠️ **Ο ένας από τους τρεις δεν ήταν καν αληθινός**: το `generatePropertyShareUrl`
 * του `ShareButton` **δεν καλούνταν από πουθενά** (νεκρός κώδικας, διαγράφηκε).
 * Οι πραγματικοί καταναλωτές είναι **δύο** και **και οι δύο εσωτερικοί**: το
 * ιστορικό αλλαγών (`audit-timeline-entry`) και η ειδοποίηση καθυστέρησης
 * (`overdue-alert.service`). Σχόλιο ≠ συμπεριφορά.
 *
 * ⚠️ **`Suspense` ΥΠΟΧΡΕΩΤΙΚΑ** (CHECK 3.55 / ADR-785): το περιεχόμενο διαβάζει τη
 * διεύθυνση μέσω `useSearchParams` (αλυσίδα `usePropertiesViewerState`), και χωρίς
 * όριο αναστολής **ολόκληρη η μεταγλώττιση παραγωγής σταματά** — όχι η σελίδα, το
 * `next build`. Το `(app)/loading.tsx` θα το κάλυπτε έτσι κι αλλιώς· γράφεται
 * ρητά ώστε η εγγύηση να μην εξαρτάται από αρχείο που κανείς δεν έχει λόγο να
 * κρατήσει.
 *
 * ⚠️ **`params` και `searchParams` είναι `Promise` (Next 15)** — ίδιο ιδίωμα με
 * `buildings/[id]` και `(light)/listing/[id]`. Συγχρονισμένη ανάγνωση εδώ
 * μεταγλωττίζεται και σπάει **στην εκτέλεση**.
 */

import React, { Suspense } from 'react';

import { PropertyDetailPageContent } from '@/components/properties/detail/PropertyDetailPageContent';
import { StaticPageLoading } from '@/core/states';

interface PropertyDetailPageProps {
  readonly params: Promise<{ readonly id: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PropertyDetailPage({
  params,
  searchParams,
}: PropertyDetailPageProps) {
  const { id } = await params;
  const query = await searchParams;

  // `?tab=` κρατά τη σύμβαση που ήδη τιμούσε η δεξιά στήλη (`urlTab`): ένας
  // σύνδεσμος προς «τα έγγραφα του Δ3» οφείλει να ανοίγει τα έγγραφα, όχι τις
  // πληροφορίες. Πίνακας τιμών ⇒ κρατάμε την πρώτη· μια καρτέλα είναι μία.
  const tab = Array.isArray(query.tab) ? query.tab[0] : query.tab;

  return (
    <Suspense fallback={<StaticPageLoading />}>
      <PropertyDetailPageContent propertyId={id} initialTab={tab} />
    </Suspense>
  );
}
