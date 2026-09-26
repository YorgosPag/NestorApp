'use client';

/**
 * **Η περιήγηση 360° στη σελίδα της αγγελίας** — το όριο φόρτωσης γύρω από την κάρτα (ADR-884 Κ3β).
 *
 * ⚠️ **ΟΡΙΟ `next/dynamic`, ίδιο δόγμα με το `ListingStay`** (ADR-744 Κ2): η κάρτα εμφανίζεται μόνο αφού απαντήσει η
 * παρουσία (δημόσια, από τον πελάτη) — **ποτέ** στο πρώτο καρέ. Άρα τα κλειδιά της (`spatial-tour`) δεν έχουν δουλειά
 * στο σύγχρονο slice **κάθε** αγγελίας· φορτώνονται μόνο όπου υπάρχει περιήγηση. Καμία δέσμευση ύψους: στις
 * περισσότερες αγγελίες η κάρτα αποδίδει **τίποτα**, και κενός χώρος θα ήταν ψέμα.
 *
 * @related components/spatial-tour/TourAccessCard.tsx · lib/spatial-tour/tour-routes.ts
 */

import dynamic from 'next/dynamic';
import React from 'react';

import { listingDetailHref } from '@/lib/listings/listing-routes';

const TourAccessCard = dynamic(() => import('@/components/spatial-tour/TourAccessCard'), { ssr: false });

export function ListingTour({ listingId }: { readonly listingId: string }): React.ReactElement {
  return <TourAccessCard listingId={listingId} returnPath={listingDetailHref(listingId)} />;
}
