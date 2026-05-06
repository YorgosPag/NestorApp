/**
 * =============================================================================
 * SharedStorageShowcasePageContent — Public Storage Showcase View (ADR-315)
 * =============================================================================
 *
 * Public page at `/shared/[token]` when entityType is `storage_showcase`.
 * Delegates rendering to StorageShowcaseClient which calls
 * GET /api/storage-showcase/[token] directly.
 *
 * @module components/shared/pages/SharedStorageShowcasePageContent
 */

'use client';

import React from 'react';
import { StorageShowcaseClient } from '@/components/storage-showcase/StorageShowcaseClient';

interface SharedStorageShowcasePageContentProps {
  token: string;
}

export function SharedStorageShowcasePageContent({
  token,
}: SharedStorageShowcasePageContentProps): React.ReactElement {
  return <StorageShowcaseClient token={token} />;
}
