'use client';

/**
 * @fileoverview **ΤΟ HARNESS ΤΟΥ ΘΕΑΤΗ** — `TourViewer` + εικονική περιήγηση + εικονικά πανοράματα (ADR-884 Φ1 · §4.8).
 * @related `components/spatial-tour/viewer/demo/*` (τα ίδια δεδομένα με τις άγκυρες RTL)
 *
 * 🔍 **Τι να κοιτάξεις**: σε κάθε σημείο το «0°» (κόκκινο) της εικόνας πρέπει να είναι εκεί που δείχνει ο κώνος όταν
 * δείχνει **πάνω** στο mini-map (βορράς). Αν όχι, κάποιο πρόσημο (heading · shader · κάμερα · κώνος) είναι λάθος.
 * ⚠️ Φραγμός στο `isNamespaceReady`: το harness δεν έχει route slice· τα ωμά κλειδιά στο πρώτο καρέ είναι η **χωριστή**
 * εργασία «λέξεις πριν από το πρώτο καρέ» (ADR-884 §4.7 Κ-ωμά) — εδώ απλώς δεν ζωγραφίζουμε πριν.
 */

import dynamic from 'next/dynamic';
import { useMemo } from 'react';

import { SPATIAL_TOUR_NS } from '@/components/spatial-tour/spatial-tour-namespace';
import { createDemoPanoramaSource } from '@/components/spatial-tour/viewer/demo/demo-panorama-source';
import { DEMO_TOUR_LEVELS, DEMO_TOUR_MANIFEST } from '@/components/spatial-tour/viewer/demo/demo-tour';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { buildViewerGraph } from '@/lib/spatial-tour/viewer/tour-viewer-graph';

const TourViewer = dynamic(
  () => import('@/components/spatial-tour/viewer/TourViewer').then((m) => m.TourViewer),
  { ssr: false },
);

export default function TourViewerHarness() {
  const { isNamespaceReady } = useTranslation(SPATIAL_TOUR_NS);
  const source = useMemo(() => {
    const graph = buildViewerGraph(DEMO_TOUR_MANIFEST, DEMO_TOUR_LEVELS);
    return createDemoPanoramaSource((nodeId) => graph.stops.get(nodeId)?.number ?? 0);
  }, []);
  return (
    <main className="mx-auto w-full max-w-5xl p-4" aria-busy={!isNamespaceReady}>
      {isNamespaceReady && <TourViewer manifest={DEMO_TOUR_MANIFEST} source={source} />}
    </main>
  );
}
