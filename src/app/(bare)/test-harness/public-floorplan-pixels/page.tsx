import { notFound } from 'next/navigation';

import { isTestHarnessRouteEnabled } from '@/config/test-harness-access';
import { PublicFloorplanPixelGateHarness } from '@/subapps/dxf-viewer/print/public-floorplan/pixel-gate/PublicFloorplanPixelGateHarness';

/**
 * ADR-909 §6.7 — το όργανο της πύλης pixels της δημόσιας κάτοψης (CHECK 3.101).
 *
 * Ίδιο μοτίβο με `/test-harness/camera-motion` και `/test-harness/address-field-width`: ο φρουρός έκθεσης
 * είναι το SSoT `isTestHarnessRouteEnabled()`. **404 σε παραγωγή.**
 */
export default function PublicFloorplanPixelGatePage() {
  if (!isTestHarnessRouteEnabled()) notFound();
  return <PublicFloorplanPixelGateHarness />;
}
