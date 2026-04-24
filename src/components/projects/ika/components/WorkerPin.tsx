/**
 * =============================================================================
 * WorkerPin — SVG Map Marker for Worker Attendance Status
 * =============================================================================
 *
 * Color-coded pin marker for MapLibre GL worker positions:
 * - Green  = checked-in, inside geofence
 * - Orange = checked-in, outside geofence
 * - Red    = checked-out
 *
 * @module components/projects/ika/components/WorkerPin
 * @enterprise ADR-170 — QR Code + GPS Geofencing + Photo Verification
 */

import React from 'react';

// =============================================================================
// STATUS → PIN COLOR MAPPING
// =============================================================================

/* eslint-disable design-system/no-hardcoded-colors -- SVG markers require literal hex strings */
export const WORKER_STATUS_COLORS = {
  inside: '#16a34a',      // green-600
  outside: '#ea580c',     // orange-600
  checked_out: '#dc2626', // red-600
} as const;
// =============================================================================
// COMPONENT
// =============================================================================

export function WorkerPin({ color }: { color: string }) {
  return (
    <svg width="24" height="32" viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg">
      {/* eslint-disable-next-line custom/no-hardcoded-strings */}
      <ellipse cx="12" cy="30" rx="5" ry="2" fill="rgba(0,0,0,0.15)" />
      <path
        d="M12 0C5.4 0 0 5.4 0 12c0 9 12 20 12 20s12-11 12-20C24 5.4 18.6 0 12 0z"
        fill={color}
        stroke="#fff"
        strokeWidth="1.5"
      />
      <circle cx="12" cy="11" r="5" fill="#fff" fillOpacity="0.9" />
      <circle cx="12" cy="11" r="2.5" fill={color} />
    </svg>
  );
}
/* eslint-enable design-system/no-hardcoded-colors */
