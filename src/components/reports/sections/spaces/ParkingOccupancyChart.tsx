'use client';

/**
 * @module reports/sections/spaces/ParkingOccupancyChart
 * @enterprise ADR-265 — Parking spaces by availability, operational status and type
 * @enterprise ADR-777 §8.60.20 — λεπτό περιτύλιγμα του κοινού `SpaceStatusChart`
 */

import { SpaceStatusChart, type SpaceStatusChartData } from './SpaceStatusChart';

/** Το λεξιλόγιο τύπων, όπως το απαριθμεί το locale (`spaces.parking.types`). */
const PARKING_TYPES = ['standard', 'handicapped', 'motorcycle', 'electric', 'visitor'] as const;

export function ParkingOccupancyChart(props: SpaceStatusChartData) {
  return <SpaceStatusChart kind="parking" sectionId="parking-occupancy" typeKeys={PARKING_TYPES} {...props} />;
}
