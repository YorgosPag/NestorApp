'use client';

/**
 * ADR-408 Φ2 — Always-on host for MEP system Firestore persistence.
 *
 * Renders `null`. Mounted in `DxfViewerTopBar` alongside the other persistence
 * hosts so the system subscription runs while the viewer is active and the
 * `useMepSystemStore` stays in sync with `floorplan_mep_systems`. Zero
 * high-frequency subscriptions — CHECK 6B/6C compliant.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import React from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import { useMepSystemPersistence } from '../hooks/data/useMepSystemPersistence';

export interface MepSystemPersistenceHostProps {
  readonly projectId?: string;
  readonly floorplanId?: string;
}

export function MepSystemPersistenceHost({
  projectId,
  floorplanId,
}: MepSystemPersistenceHostProps): React.ReactElement | null {
  const { user } = useAuth();

  useMepSystemPersistence({
    companyId: user?.companyId ?? null,
    projectId,
    floorplanId,
    userId: user?.uid ?? null,
  });

  return null;
}
