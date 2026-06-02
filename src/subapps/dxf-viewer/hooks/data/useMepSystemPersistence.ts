'use client';

/**
 * ADR-408 Φ2 — MEP system Firestore persistence React adapter.
 *
 * Bridges `MepSystemFirestoreService` to `useMepSystemStore`. Unlike the
 * fixture hook there is no scene model and no debounced auto-save: systems are
 * mutated by explicit user actions (create circuit / assign / remove — Φ5), so
 * the public API is imperative `create/update/delete`. The subscribe path keeps
 * the store in sync with Firestore (optimistic-write-aware).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';

import { EventBus } from '../../systems/events/EventBus';
import { useMepSystemStore } from '../../bim/mep-systems/mep-system-store';
import {
  createMepSystemFirestoreService,
  docToSystemEntity,
  MepSystemFirestoreService,
  type MepSystemDoc,
} from '../../bim/mep-systems/mep-system-firestore-service';
import { recordMepSystemChange } from '../../bim/mep-systems/mep-system-audit-client';
import { setMepSystemMutator } from '../../bim/mep-systems/mep-system-mutator';
import type { MepSystemEntity, MepSystemParams } from '../../bim/types/mep-system-types';

export interface UseMepSystemPersistenceParams {
  readonly companyId: string | null;
  readonly projectId: string | null | undefined;
  readonly floorplanId: string | null | undefined;
  readonly userId: string | null;
}

export interface UseMepSystemPersistenceResult {
  readonly createSystem: (params: MepSystemParams) => Promise<MepSystemEntity | null>;
  readonly updateSystem: (systemId: string, params: MepSystemParams) => Promise<void>;
  readonly deleteSystem: (systemId: string) => Promise<void>;
  /** ADR-408 Φ4 — undo of a dissolve: id-preserving re-create. */
  readonly restoreSystem: (entity: MepSystemEntity) => Promise<void>;
}

export function useMepSystemPersistence(
  params: UseMepSystemPersistenceParams,
): UseMepSystemPersistenceResult {
  const { companyId, projectId, floorplanId, userId } = params;

  const serviceRef = useRef<MepSystemFirestoreService | null>(null);
  const deletedIdsRef = useRef<Set<string>>(new Set());

  // Instantiate service when auth + scope ready.
  useEffect(() => {
    if (!companyId || !projectId || !floorplanId || !userId) {
      serviceRef.current = null;
      return;
    }
    serviceRef.current = createMepSystemFirestoreService({ companyId, projectId, floorplanId, userId });
  }, [companyId, projectId, floorplanId, userId]);

  // Subscribe → store. Drop locally-deleted ids (await server echo).
  useEffect(() => {
    const svc = serviceRef.current;
    if (!svc) return;
    const unsubscribe = svc.subscribeSystems(
      (docs: readonly MepSystemDoc[]) => {
        const deleted = deletedIdsRef.current;
        const systems = docs.filter((d) => !deleted.has(d.id)).map(docToSystemEntity);
        useMepSystemStore.getState().setSystems(systems);
      },
      () => { /* read errors are non-fatal for this slice */ },
    );
    return () => unsubscribe();
  }, [companyId, projectId, floorplanId, userId]);

  const createSystem = useCallback(async (sysParams: MepSystemParams) => {
    const svc = serviceRef.current;
    if (!svc) return null;
    const doc = await svc.saveSystem({ params: sysParams });
    const entity = docToSystemEntity(doc);
    useMepSystemStore.getState().upsertSystem(entity);
    void recordMepSystemChange('created', { id: entity.id, params: sysParams });
    EventBus.emit('bim:mep-system-changed', { systemId: entity.id });
    return entity;
  }, []);

  const updateSystem = useCallback(async (systemId: string, sysParams: MepSystemParams) => {
    const svc = serviceRef.current;
    if (!svc) return;
    const prev = useMepSystemStore.getState().getSystems().find((s) => s.id === systemId);
    await svc.updateSystem(systemId, { params: sysParams });
    useMepSystemStore.getState().upsertSystem({ ...(prev ?? { id: systemId }), id: systemId, params: sysParams });
    void recordMepSystemChange('updated', { id: systemId, params: sysParams }, { prevParams: prev?.params ?? null });
    EventBus.emit('bim:mep-system-changed', { systemId });
  }, []);

  const deleteSystem = useCallback(async (systemId: string) => {
    const svc = serviceRef.current;
    if (!svc) return;
    const prev = useMepSystemStore.getState().getSystems().find((s) => s.id === systemId);
    deletedIdsRef.current.add(systemId);
    try {
      await svc.deleteSystem(systemId);
      if (prev) void recordMepSystemChange('deleted', { id: systemId, params: prev.params });
    } finally {
      useMepSystemStore.getState().removeSystem(systemId);
    }
  }, []);

  // ADR-408 Φ4 — undo of a dissolve. Re-create the system id-preserving and
  // un-suppress it so the server echo is honoured again.
  const restoreSystem = useCallback(async (entity: MepSystemEntity) => {
    const svc = serviceRef.current;
    if (!svc) return;
    deletedIdsRef.current.delete(entity.id);
    useMepSystemStore.getState().upsertSystem(entity);
    try {
      await svc.saveSystem({ id: entity.id, params: entity.params });
      void recordMepSystemChange('restored', { id: entity.id, params: entity.params });
      EventBus.emit('bim:mep-system-changed', { systemId: entity.id });
    } catch {
      // Non-fatal: restore failure silent — the optimistic store entry stands.
    }
  }, []);

  // ADR-408 Φ4 — expose the imperative api to the command layer (cascade
  // dissolve / member-removal commands). Registered while the host is mounted.
  useEffect(() => {
    setMepSystemMutator({
      updateSystemParams: (id, params) => { void updateSystem(id, params); },
      dissolveSystem: (id) => { void deleteSystem(id); },
      restoreSystem: (entity) => { void restoreSystem(entity); },
    });
    return () => setMepSystemMutator(null);
  }, [updateSystem, deleteSystem, restoreSystem]);

  return useMemo(
    () => ({ createSystem, updateSystem, deleteSystem, restoreSystem }),
    [createSystem, updateSystem, deleteSystem, restoreSystem],
  );
}
