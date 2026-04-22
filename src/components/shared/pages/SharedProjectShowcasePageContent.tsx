/**
 * =============================================================================
 * SharedProjectShowcasePageContent — Public Project Showcase View (ADR-316)
 * =============================================================================
 *
 * Public page at `/shared/[token]` when entityType is `project_showcase`.
 * Delegates rendering to ProjectShowcaseClient which calls
 * GET /api/project-showcase/[token] directly.
 *
 * @module components/shared/pages/SharedProjectShowcasePageContent
 */

'use client';

import React from 'react';
import { ProjectShowcaseClient } from '@/components/project-showcase/ProjectShowcaseClient';

interface SharedProjectShowcasePageContentProps {
  token: string;
}

export function SharedProjectShowcasePageContent({
  token,
}: SharedProjectShowcasePageContentProps): React.ReactElement {
  return <ProjectShowcaseClient token={token} />;
}
