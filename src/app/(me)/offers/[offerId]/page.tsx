/**
 * **`/offers/[offerId]` — μία αγγελία ιδιοκτήτη**, και ο δρόμος της προς τον κόσμο.
 *
 * ⚠️ **Το `params` είναι `Promise` (Next 15)** — ίδιο ιδίωμα με `listing/[id]` και
 * `demands/[demandId]`. Ένα συγχρονισμένο `params.offerId` εδώ θα **μεταγλωττιζόταν**
 * και θα έσπαγε στην εκτέλεση.
 *
 * 🔑 **Καμία `generateMetadata`, και ΔΕΝ είναι παράλειψη.** Το `(me)/layout.tsx`
 * δηλώνει `robots: noindex` για **όλο** το group: το έγγραφο κουβαλά τη **διεύθυνση
 * του σπιτιού** ενός ανθρώπου και τα **μονοπάτια των αρχείων του** — επίπεδο Β,
 * αυστηρά ιδιωτικό. Ό,τι επιτρέπεται να ευρετηριαστεί είναι η **δημόσια προβολή**
 * (`/listing/[id]`), που έχει κλειστό σχήμα χωρίς κανένα από τα δύο.
 *
 * ⚠️ **Το δυναμικό τμήμα λέγεται `offerId` και η οντότητα `OwnerProperty`** — η
 * διαδρομή ονομάζει την **πράξη** («προσφέρω», κάτοπτρο του `/demands`), ο τύπος την
 * **οντότητα**. Δες `lib/owner-property/owner-property-routes.ts`.
 *
 * @module app/(me)/offers/[offerId]/page
 */

import { OwnerPropertyDetailContent } from '@/components/owner-property/OwnerPropertyDetailContent';

interface OfferDetailPageProps {
  readonly params: Promise<{ readonly offerId: string }>;
}

export default async function OfferDetailPage({ params }: OfferDetailPageProps) {
  const { offerId } = await params;

  return <OwnerPropertyDetailContent ownerPropertyId={offerId} />;
}
