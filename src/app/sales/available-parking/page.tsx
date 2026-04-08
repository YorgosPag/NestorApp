'use client';

/**
 * @module /sales/available-parking
 * @enterprise ADR-199 — Sales Available Parking
 * @lazy ADR-294 Batch 3 — Thin wrapper, content loaded via dynamic import
 */

import { LazyRoutes } from '@/utils/lazyRoutes';

const SalesAvailableParking = LazyRoutes.SalesAvailableParking;

export default function AvailableParkingPage() {
  return <SalesAvailableParking />;
}
