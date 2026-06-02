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
import type { SceneModel } from '../types/scene';
import type { useLevels } from '../systems/levels';
import { useMepSystemPersistence } from '../hooks/data/useMepSystemPersistence';
import { useMepConnectorReconciliation } from '../hooks/data/useMepConnectorReconciliation';
import { useMepCircuitEditorSync } from '../hooks/data/useMepCircuitEditorSync';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

export interface MepSystemPersistenceHostProps {
  readonly projectId?: string;
  readonly floorplanId?: string;
  /** ADR-408 Φ5 — needed by the connector-reconciliation pass (scene-time cache). */
  readonly currentScene: SceneModel | null;
  readonly levelManager: LevelManagerLike;
  /** ADR-408 Φ6 — drives the "active managed circuit" sync for the editing UI. */
  readonly primarySelectedId: string | null;
}

export function MepSystemPersistenceHost({
  projectId,
  floorplanId,
  currentScene,
  levelManager,
  primarySelectedId,
}: MepSystemPersistenceHostProps): React.ReactElement | null {
  const { user } = useAuth();

  useMepSystemPersistence({
    companyId: user?.companyId ?? null,
    projectId,
    floorplanId,
    userId: user?.uid ?? null,
  });

  // ADR-408 Φ5 — keep each fixture/panel connector's `systemId` cache in sync
  // with the System membership truth (scene-only, idempotent, "System wins").
  useMepConnectorReconciliation({ currentScene, levelManager });

  // ADR-408 Φ6 — keep the contextual editor's active circuit in sync with the
  // selection (fixture → its circuit, panel → the circuits it feeds).
  useMepCircuitEditorSync({ primarySelectedId, currentScene });

  return null;
}
