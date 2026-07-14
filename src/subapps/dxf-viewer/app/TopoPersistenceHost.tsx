'use client';

/**
 * ADR-650 — Always-on host for topographic surface-definition persistence (renders `null`).
 *
 * Mounted in `DxfViewerTopBar`. Wires `useTopoPersistence` with auth + floor scope. The
 * surveyed DEFINITION (points/breaklines/boundary + contour/3D/cut-fill settings) persists
 * per-floor in `floorplan_topo_surfaces`; the contours/TIN are regenerated on load. Zero
 * high-frequency subscriptions (CHECK 6B/6C).
 *
 * @see ../hooks/data/useTopoPersistence.ts
 */

import React from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import { useTopoPersistence } from '../hooks/data/useTopoPersistence';

export interface TopoPersistenceHostProps {
  readonly projectId?: string;
  readonly floorplanId?: string;
  readonly floorId?: string;
}

export function TopoPersistenceHost({
  projectId,
  floorplanId,
  floorId,
}: TopoPersistenceHostProps): React.ReactElement | null {
  const { user } = useAuth();

  useTopoPersistence({
    companyId: user?.companyId ?? null,
    projectId,
    floorplanId,
    floorId,
    userId: user?.uid ?? null,
  });

  return null;
}
