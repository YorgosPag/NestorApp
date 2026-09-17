/**
 * **`/offers/[offerId]/calendar` — το ημερολόγιο κρατήσεων μιας αγγελίας βραχυχρόνιας μίσθωσης.**
 *
 * ⚠️ **Το `params` είναι `Promise` (Next 15)** — ίδιο ιδίωμα με το `/offers/[offerId]`.
 *
 * 🔑 **Καμία `generateMetadata`**: το `(me)/layout.tsx` δηλώνει `robots: noindex` για όλο το
 * group — το ημερολόγιο κουβαλά ονόματα επισκεπτών και ιδιωτικές σημειώσεις (επίπεδο Β).
 *
 * @related ADR-835 §20 (Στάδιο Α)
 * @module app/(me)/offers/[offerId]/calendar/page
 */

import { StayCalendarContent } from '@/components/stay-calendar/StayCalendarContent';

interface OfferCalendarPageProps {
  readonly params: Promise<{ readonly offerId: string }>;
}

export default async function OfferCalendarPage({ params }: OfferCalendarPageProps) {
  const { offerId } = await params;

  return <StayCalendarContent ownerPropertyId={offerId} />;
}
