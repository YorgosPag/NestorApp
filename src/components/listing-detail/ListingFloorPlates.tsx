'use client';

/**
 * @fileoverview 🏢 **Η ΚΑΤΟΨΗ ΟΡΟΦΟΥ ΤΗΣ ΑΓΓΕΛΙΑΣ** — έκτο φύλλο του προβολέα: ο όροφος με τις μονάδες του (ADR-907 §11.9).
 * @related ADR-907 §11 · ListingFloorplans / ListingVideos (τα αδελφά φύλλα) · lib/listings/floor-plate/floor-plate-publication
 * @module components/listing-detail/ListingFloorPlates
 *
 * 🔑 **Ξεχωριστό φύλλο, γιατί το σχήμα τη χώρισε** (`floorPlates[]`, όχι μέσα στα `floorplans[]`): η κάτοψη της μονάδας
 * είναι υλικό του **ακινήτου**· αυτή δείχνει και **ξένες** μονάδες, με δική της επιμέλεια (δήλωση με υπογραφή ανά όροφο).
 *
 * ⛔ **Καμία ονομασμένη απουσία**, όπως στα αδέλφια: η κάτοψη ορόφου είναι προαιρετική — χωρίς αυτήν η καρτέλα απλώς
 * δεν υπάρχει. Ο κριτής είναι **ο ίδιος** που ρωτά και η καρτέλα (`presentableFloorPlate`).
 *
 * ⚠️ **Καμία επικεφαλίδα**: το φύλλο ζει **μόνο** μέσα σε καρτέλα του προβολέα, που λέει ήδη «Κάτοψη ορόφου». Η ενότητα
 * κρατά το `aria-label` της.
 */

import dynamic from 'next/dynamic';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { presentableFloorPlate } from '@/lib/listings/floor-plate/floor-plate-publication';
import type { PublicListing } from '@/types/public-listing';

/**
 * 🔑 **Πίσω από όριο `next/dynamic`**, όπως η σκηνή της κάτοψης μονάδας: το `useZoomPan`, ο πόλος απροσπέλαστου, το
 * υπόμνημα και οι προτάσεις τους δεν ανήκουν στο πρώτο καρέ ούτε στο route slice της αγγελίας (CHECK 3.34) — η καρτέλα
 * δεν είναι ποτέ η προεπιλογή. Συνέπεια που μετριέται στο δίκτυο: η εικόνα του ορόφου **δεν** ζητείται πριν ανοίξει.
 */
const ListingFloorPlateStage = dynamic(
  () => import('./media/ListingFloorPlateStage').then((m) => m.ListingFloorPlateStage),
  { ssr: false, loading: () => <span aria-hidden className="block aspect-[4/3] max-h-[70vh] animate-pulse rounded-lg bg-muted" /> },
);

export function ListingFloorPlates({ listing }: { readonly listing: PublicListing }) {
  const { t } = useTranslation(['listing-detail']);
  const plate = presentableFloorPlate(listing);

  if (plate === null) return null;

  return (
    <section aria-label={t('listing-detail:media.tabs.floorPlate')} className="flex flex-col gap-2">
      <ListingFloorPlateStage plate={plate} />
    </section>
  );
}
