'use client';

/**
 * ADR-408 Φ6 — keep the "active managed circuit" in sync with the selection.
 *
 * Always-on side-effect hook (mounted in `MepSystemPersistenceHost`): resolves
 * the circuits the primary-selected entity touches (a fixture → its one circuit,
 * a panel → the circuits it feeds) and reconciles
 * `useMepCircuitEditorStore.activeSystemId` against them — keeping a still-valid
 * pick, otherwise defaulting to the first candidate (or clearing it). The
 * Circuit-Properties widgets read `activeSystemId`; the picker widget overrides
 * it when a panel feeds several circuits.
 *
 * Driven by props (primary id + scene) rather than `useUniversalSelection` so it
 * is provider-agnostic and mounts next to the other persistence hosts. Reads the
 * systems store reactively; zero high-frequency subscriptions (CHECK 6B/6C safe).
 *
 * @see ../../bim/mep-systems/mep-circuit-editor.ts
 * @see ../../bim/mep-systems/mep-circuit-editor-store.ts
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import { useEffect, useMemo } from 'react';
import type { SceneModel } from '../../types/scene';
import { useMepSystemStore } from '../../bim/mep-systems/mep-system-store';
import { useMepCircuitEditorStore } from '../../bim/mep-systems/mep-circuit-editor-store';
import { resolveManagedSystems } from '../../bim/mep-systems/mep-circuit-editor';

export interface UseMepCircuitEditorSyncProps {
  readonly primarySelectedId: string | null;
  readonly currentScene: SceneModel | null;
}

export function useMepCircuitEditorSync({
  primarySelectedId,
  currentScene,
}: UseMepCircuitEditorSyncProps): void {
  const systems = useMepSystemStore((s) => s.systems);
  const setActiveSystemId = useMepCircuitEditorStore((s) => s.setActiveSystemId);

  const candidateIds = useMemo<string[]>(() => {
    if (!primarySelectedId || !currentScene) return [];
    const entity = currentScene.entities.find((e) => e.id === primarySelectedId);
    if (!entity) return [];
    return resolveManagedSystems([entity], systems).map((c) => c.id);
  }, [primarySelectedId, currentScene, systems]);

  useEffect(() => {
    const current = useMepCircuitEditorStore.getState().activeSystemId;
    if (current && candidateIds.includes(current)) return; // still valid — keep the pick
    setActiveSystemId(candidateIds[0] ?? null);
  }, [candidateIds, setActiveSystemId]);
}
