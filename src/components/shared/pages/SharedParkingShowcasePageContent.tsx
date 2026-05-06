/**
 * =============================================================================
 * SharedParkingShowcasePageContent — Public Parking Showcase View (ADR-315)
 * =============================================================================
 *
 * Public page at `/shared/[token]` when entityType is `parking_showcase`.
 * Delegates rendering to ParkingShowcaseClient which calls
 * GET /api/parking-showcase/[token] directly.
 *
 * @module components/shared/pages/SharedParkingShowcasePageContent
 */

'use client';

import React from 'react';
import { ParkingShowcaseClient } from '@/components/parking-showcase/ParkingShowcaseClient';

interface SharedParkingShowcasePageContentProps {
  token: string;
}

export function SharedParkingShowcasePageContent({
  token,
}: SharedParkingShowcasePageContentProps): React.ReactElement {
  return <ParkingShowcaseClient token={token} />;
}
