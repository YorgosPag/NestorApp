/**
 * @fileoverview `/offers/[offerId]/tour` — η περιήγηση 360° της αγγελίας του ιδιώτη (ADR-884 Κ3α).
 * @related `components/spatial-tour/OfferTourContent.tsx` · πρότυπο `offers/[offerId]/calendar/page.tsx` (ADR-835 §20)
 * @module app/(me)/offers/[offerId]/tour/page
 *
 * 🔑 **Χωριστή σελίδα, ίδιο δόγμα με το ημερολόγιο**: το slice της καρτέλας αγγελίας (η μεγαλύτερη του `(me)`) δεν
 * κουβαλά το λεξιλόγιο της περιήγησης (ADR-744 §20). Ποιος διαχειρίζεται το κρίνει ο διακομιστής (`mayManageTour`).
 */

import { OfferTourContent } from '@/components/spatial-tour/OfferTourContent';

interface OfferTourPageProps {
  readonly params: Promise<{ readonly offerId: string }>;
}

export default async function OfferTourPage({ params }: OfferTourPageProps) {
  const { offerId } = await params;
  return <OfferTourContent ownerPropertyId={offerId} />;
}
