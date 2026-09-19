'use client';

/**
 * @module reports/sections/spaces/StorageUtilizationChart
 * @enterprise ADR-265 — Storage units by availability, operational status and type
 * @enterprise ADR-777 §8.60.20 — λεπτό περιτύλιγμα του κοινού `SpaceStatusChart`
 */

import { SpaceStatusChart, type SpaceStatusChartData } from './SpaceStatusChart';

/** Το λεξιλόγιο τύπων, όπως το απαριθμεί το locale (`spaces.storage.types`). */
const STORAGE_TYPES = [
  'large',
  'small',
  'basement',
  'ground',
  'special',
  'storage',
  'garage',
  'warehouse',
] as const;

export function StorageUtilizationChart(props: SpaceStatusChartData) {
  return <SpaceStatusChart kind="storage" sectionId="storage-utilization" typeKeys={STORAGE_TYPES} {...props} />;
}
