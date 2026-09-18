/**
 * **`/dossiers/[dossierId]` — ένας φάκελος ακινήτου** (ADR-866 Φ1.2): κάτοψη · έγγραφα · φωτογραφίες · βίντεο · ιστορικό.
 *
 * ⚠️ **Το `params` είναι `Promise` (Next 15)** — ίδιο ιδίωμα με `offers/[offerId]` και `demands/[demandId]`.
 *
 * 🔑 **Καμία `generateMetadata`**: το `(me)/layout.tsx` δηλώνει `robots: noindex` για **όλο** το group — ο φάκελος
 * κουβαλά τα **έγγραφα του σπιτιού** ενός ανθρώπου (επίπεδο Β, αυστηρά ιδιωτικό), και μια ευρετηριασμένη διεύθυνση
 * `pdos_…` θα ήταν δημόσια ορατή ταυτότητα.
 *
 * @module app/(me)/dossiers/[dossierId]/page
 */

import { PropertyDossierDetailContent } from '@/components/property-dossier/PropertyDossierDetailContent';

interface DossierDetailPageProps {
  readonly params: Promise<{ readonly dossierId: string }>;
}

export default async function DossierDetailPage({ params }: DossierDetailPageProps) {
  const { dossierId } = await params;

  return <PropertyDossierDetailContent dossierId={dossierId} />;
}
