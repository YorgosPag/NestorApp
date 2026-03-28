/**
 * =============================================================================
 * GeofenceMarkerPin — SVG Marker for Geofence Center Point
 * =============================================================================
 *
 * Custom SVG pin rendered as the draggable center marker on the geofence map.
 *
 * @module components/projects/ika/components/GeofenceMarkerPin
 * @enterprise ADR-170 — QR Code + GPS Geofencing + Photo Verification
 */

import React from 'react';

/* eslint-disable design-system/no-hardcoded-colors -- SVG marker requires literal color strings */
export function GeofenceMarkerPin() {
  return (
    <svg width="32" height="42" viewBox="0 0 32 42" xmlns="http://www.w3.org/2000/svg">
      {/* eslint-disable-next-line custom/no-hardcoded-strings */}
      <ellipse cx="16" cy="40" rx="6" ry="2" fill="rgba(0,0,0,0.2)" />
      <path
        d="M16 0C7.2 0 0 7.2 0 16c0 12 16 26 16 26s16-14 16-26C32 7.2 24.8 0 16 0z"
        fill="#dc2626"
        stroke="#fff"
        strokeWidth="1.5"
      />
      <circle cx="16" cy="15" r="6" fill="#fff" />
      <circle cx="16" cy="15" r="3" fill="#dc2626" />
    </svg>
  );
}
/* eslint-enable design-system/no-hardcoded-colors */
