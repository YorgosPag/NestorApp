'use client';

/**
 * ADR-441 Slice 1 — Always-on host για Grid (guides) persistence (renders `null`).
 *
 * Mounted στο `DxfViewerTopBar`. Wires `useGridGuidePersistence` με auth +
 * floor scope. Ο κάναβος (ADR-189 global store) persist-άρεται per-floor σε
 * `floorplan_grid_guides`. Zero high-frequency subscriptions (CHECK 6B/6C).
 *
 * @see ../hooks/data/useGridGuidePersistence.ts
 * @see docs/centralized-systems/reference/adrs/ADR-441-foundation-strip-grid-auto-design.md
 */

import React from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import { useGridGuidePersistence } from '../hooks/data/useGridGuidePersistence';

export interface GridGuidePersistenceHostProps {
  readonly projectId?: string;
  readonly floorplanId?: string;
  readonly floorId?: string;
}

export function GridGuidePersistenceHost({
  projectId,
  floorplanId,
  floorId,
}: GridGuidePersistenceHostProps): React.ReactElement | null {
  const { user } = useAuth();

  useGridGuidePersistence({
    companyId: user?.companyId ?? null,
    projectId,
    floorplanId,
    floorId,
    userId: user?.uid ?? null,
  });

  return null;
}
