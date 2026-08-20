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
 * ⚠️ **`params` είναι `Promise` (Next 15)** — ίδιο ιδίωμα με `buildings/[id]` και
 * `(light)/listing/[id]`. Συγχρονισμένη ανάγνωση εδώ μεταγλωττίζεται και σπάει
 * **στην εκτέλεση**.
 *
 * 🔴 **ΤΟ `?tab=` ΔΙΑΒΑΖΕΤΑΙ ΣΤΟΝ ΠΕΛΑΤΗ, ΚΑΙ ΤΟ ΑΠΟΦΑΣΙΣΕ ΖΩΝΤΑΝΗ ΜΕΤΡΗΣΗ.**
 *
 * Η πρώτη γραφή το διάβαζε εδώ, από `searchParams`. Φαινόταν καθαρότερο — και
 * έκανε τη διαδρομή **δυναμική**, οπότε το όριο αναστολής **δεν** έπεφτε στο
 * `fallback` και ο διακομιστής απέδιδε το περιεχόμενο. Το `properties-detail`
 * όμως υπάρχει στο i18n shell slice με **μηδέν κλειδιά** (κομμένο σε επίπεδο
 * κλειδιού, ADR-744), άρα το HTML που έφευγε από τον διακομιστή περιείχε **ωμά
 * κλειδιά** — `detailPage.back`, `detailPage.absent`… Μετρημένο στο σερβιρισμένο
 * HTML, όχι υποθετικά.
 *
 * Κάθε αδελφή σελίδα (`/properties`, `/spaces/properties`) μένει στο `fallback`
 * ακριβώς επειδή **δεν** αγγίζει `searchParams` στον διακομιστή. Το ιδίωμα
 * υπήρχε· η «βελτίωση» ήταν που το έσπασε.
 *
 * ⚠️ **ΜΗΝ ξαναπροσθέσεις `searchParams` εδώ** για να «περάσεις καθαρά props».
 */

import React, { Suspense } from 'react';

import { PropertyDetailPageContent } from '@/components/properties/detail/PropertyDetailPageContent';
import { StaticPageLoading } from '@/core/states';

interface PropertyDetailPageProps {
  readonly params: Promise<{ readonly id: string }>;
}

export default async function PropertyDetailPage({ params }: PropertyDetailPageProps) {
  const { id } = await params;

  return (
    <Suspense fallback={<StaticPageLoading />}>
      <PropertyDetailPageContent propertyId={id} />
    </Suspense>
  );
}
