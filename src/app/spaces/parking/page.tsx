'use client';

/**
 * @module /spaces/parking
 * @enterprise Parking Management
 * @lazy ADR-294 Batch 3 — Thin wrapper, content loaded via dynamic import
 */

import { LazyRoutes } from '@/utils/lazyRoutes';

const SpacesParking = LazyRoutes.SpacesParking;

export default function ParkingPage() {
  return <SpacesParking />;
}
