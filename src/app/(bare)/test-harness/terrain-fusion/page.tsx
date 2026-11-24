import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { isTerrainFusionProbeRouteEnabled } from '@/config/test-harness-access';

import TerrainFusionHarness from './TerrainFusionHarness';

/**
 * ADR-920 §14.12 Β0 — δοκιμή εφικτότητας της σύντηξης υψομέτρων.
 *
 * Η **μόνη** σελίδα δοκιμής που απαντά στην παραγωγή, και μόνο ως τη δηλωμένη ημερομηνία
 * (`isTerrainFusionProbeRouteEnabled`). Αποδίδεται **ανά αίτημα**, ώστε η ημερομηνία να κρίνεται κάθε φορά και όχι μία
 * φορά στο build. Κλείνει στο commit που γράφει τα αποτελέσματα του Β0.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function TerrainFusionHarnessPage() {
  if (!isTerrainFusionProbeRouteEnabled()) notFound();
  return <TerrainFusionHarness />;
}
