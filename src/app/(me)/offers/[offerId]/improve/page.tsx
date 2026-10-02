/**
 * @fileoverview `/offers/[offerId]/improve` — «Βελτίωσε την αγγελία σου» (ADR-898 Φ3β-2 · ADR-842 Φ4).
 * @related `components/owner-property/improve/OwnerListingImproveContent.tsx` · πρότυπο `offers/[offerId]/tour/page.tsx`
 * @module app/(me)/offers/[offerId]/improve/page
 *
 * 🔑 **Χωριστή σελίδα, ίδιο δόγμα με το ημερολόγιο και την περιήγηση**: το slice της καρτέλας αγγελίας (η μεγαλύτερη του
 * `(me)`) δεν κουβαλά τις ερωτήσεις (ADR-744 §20). Η `/offers/new` μένει **8 πεδία** (ADR-842 Α2).
 */

import { OwnerListingImproveContent } from '@/components/owner-property/improve/OwnerListingImproveContent';

interface OfferImprovePageProps {
  readonly params: Promise<{ readonly offerId: string }>;
}

export default async function OfferImprovePage({ params }: OfferImprovePageProps) {
  const { offerId } = await params;
  return <OwnerListingImproveContent ownerPropertyId={offerId} />;
}
