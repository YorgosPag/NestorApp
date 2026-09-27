'use client';

/**
 * @fileoverview **Ο ΘΕΑΤΗΣ ΣΤΙΣ ΣΕΛΙΔΕΣ** — ο `TourViewer` πίσω από `next/dynamic`, με την πραγματική πηγή πλακιδίων
 * (ADR-884 Φ2γ · §4.9).
 * @related `TourViewSurface.tsx` (η ΜΙΑ επιφάνεια θέασης — σελίδα αγγελίας **και** προσωπικός σύνδεσμος) ·
 *   `tile-panorama-source.ts` (τα πλακίδια) · `TourViewer.tsx`
 * @module components/spatial-tour/viewer/TourViewerLoader
 *
 * 🔑 **Το `three` δεν μπαίνει στο αρχικό πακέτο της σελίδας**: `dynamic({ ssr: false })` — ο θεατής κατεβαίνει μόνο όταν
 * υπάρχει κάτι να δειχτεί (`manifest.ready`). Μαζί του ταξιδεύουν και οι λέξεις του (`TOUR_VIEWER_KEYS`), έξω από το
 * route slice της σελίδας επίτηδες (§4.8).
 * 🔑 **Καμία ζωγραφική πριν τις λέξεις** (`isNamespaceReady`) — ίδιος φραγμός με το harness· η γενική λύση είναι η χωριστή
 * εργασία «λέξεις πριν από το πρώτο καρέ» (§4.7 Κ-ωμά).
 */

import dynamic from 'next/dynamic';
import { useMemo } from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { TourManifest } from '@/server/spatial-tour/tour-view-session';
import type { TourSubject } from '@/types/spatial-tour';

import { SPATIAL_TOUR_NS } from '../spatial-tour-namespace';
import { createTilePanoramaSource } from './tile-panorama-source';

const TourViewer = dynamic(() => import('./TourViewer').then((m) => m.TourViewer), { ssr: false });

interface TourViewerLoaderProps {
  readonly subject: TourSubject;
  readonly manifest: TourManifest;
}

export function TourViewerLoader({ subject, manifest }: TourViewerLoaderProps) {
  const { isNamespaceReady } = useTranslation(SPATIAL_TOUR_NS);
  // Μία πηγή ανά περιήγηση — ίδια ρίζα ⇒ ίδια διαδρομή μέσων (η ταυτότητα του `subject` αλλάζει μόνο με τη ρίζα).
  const source = useMemo(() => createTilePanoramaSource(subject), [subject]);
  if (!isNamespaceReady) return null;
  return <TourViewer manifest={manifest} source={source} />;
}
