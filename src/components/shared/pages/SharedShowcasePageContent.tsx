/**
 * =============================================================================
 * SharedShowcasePageContent — Public Property Showcase View (ADR-315 Phase M3)
 * =============================================================================
 *
 * Public page accessible without authentication at `/shared/[token]` when the
 * share's entityType is `property_showcase`. Replaces the legacy redirect to
 * `/shared/po/[token]` from ADR-312. Under ADR-315 all three entity types
 * share a single public URL family.
 *
 * Rendering: delegates to the canonical `ShowcaseClient` (used by the legacy
 * `/showcase/[token]` route). `/api/showcase/[token]` is dual-read (unified
 * `shares` + legacy `file_shares`) so the same API serves both entry points.
 *
 * @module components/shared/pages/SharedShowcasePageContent
 */

'use client';

import React from 'react';
import { ShowcaseClient } from '@/components/property-showcase/ShowcaseClient';

interface SharedShowcasePageContentProps {
  token: string;
}

export function SharedShowcasePageContent({
  token,
}: SharedShowcasePageContentProps): React.ReactElement {
  return <ShowcaseClient token={token} />;
}
