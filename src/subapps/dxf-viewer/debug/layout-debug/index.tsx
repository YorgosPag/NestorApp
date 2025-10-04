export { default as CornerMarkers } from './CornerMarkers';
export { default as LayoutMapper } from './LayoutMapper';
export { default as CoordinateDebugOverlay } from './CoordinateDebugOverlay';

// Combined Debug Component
import React from 'react';
import CornerMarkers from './CornerMarkers';
import LayoutMapper from './LayoutMapper';
import CoordinateDebugOverlay from './CoordinateDebugOverlay';

export function FullLayoutDebug() {
  return (
    <>
      <CornerMarkers />
      <LayoutMapper />
      <CoordinateDebugOverlay />
    </>
  );
}