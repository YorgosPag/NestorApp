'use client';

/**
 * ADR-650 — Always-on host for topographic surface-definition persistence (renders `null`).
 *
 * Mounted in `DxfViewerTopBar`. Wires `useTopoPersistence` with auth + SITE scope. The
 * surveyed DEFINITION (points/breaklines/boundary + contour/3D/cut-fill settings) persists
 * once per project (SITE-level, `floorplan_topo_surfaces`); the contours are regenerated on
 * load and onto EVERY storey (IfcSite terrain, visible on all levels). `floorId`/`floorplanId`
 * are passed as provenance only. Zero high-frequency subscriptions (CHECK 6B/6C).
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
