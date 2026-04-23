/**
 * =============================================================================
 * SharedBuildingShowcasePageContent — Public Building Showcase View (ADR-320)
 * =============================================================================
 *
 * Public page at `/shared/[token]` when entityType is `building_showcase`.
 * Delegates rendering to BuildingShowcaseClient which calls
 * GET /api/building-showcase/[token] directly.
 *
 * @module components/shared/pages/SharedBuildingShowcasePageContent
 */

'use client';

import React from 'react';
import { BuildingShowcaseClient } from '@/components/building-showcase/BuildingShowcaseClient';

interface SharedBuildingShowcasePageContentProps {
  token: string;
}

export function SharedBuildingShowcasePageContent({
  token,
}: SharedBuildingShowcasePageContentProps): React.ReactElement {
  return <BuildingShowcaseClient token={token} />;
}
