'use client';

/**
 * ADR-594 — `createBimEntityPersistenceHook`: ONE generic factory that replaces
 * the ~21 byte-identical BIM entity Firestore persistence hooks.
 *
 * The invariant scaffold (state / refs / scope-effect / ca9-stable subscribe /
 * debounced autosave / saveNow / delete / persistRestore / created+delete
 * listeners / moved+restored effects / unmount flush / memoised return) lives HERE
 * once. Per-entity variance is injected via `config` (see the types module): a
 * minimal required core (service adapter + merge strategy + comparable) plus
 * optional overrides with sane defaults plus a single `useExtra` escape hatch.
 *
 * Behaviour is preserved 1:1 with the hand-rolled hooks. Two deliberate,
 * behaviour-neutral generalisations vs the originals (documented in ADR-594 §Notes):
 *   1. `persist` / `deleteEntity` read live scope through a ref at event time
 *      (stable identity) rather than closing over scope in dep arrays — the
 *      codebase's event-time-read pattern; the observable Firestore writes are
 *      identical.
 *   2. A hook that opts out of the moved-persist effect (`enableMovedEffect:false`,
 *      underfloor) still mounts the shared listener with a no-op persist — same
 *      observable result (no persistence on move), no conditional hook call.
 *
 * ADR-594 Phase 2 — the former divergent members (wall / opening / mep-segment) are
 * ALSO built from this factory, via three additive, off-by-default core hooks:
 * `beforeSave` (async pre-save transform), `raceGuardDelete` (delete-wins guard) and
 * `autoSaveTrigger` (event-driven autosave). The ~21 majority hooks are unaffected.
 *
 * @see ./bim-entity-persistence-hook-types.ts — the config contract
 * @see docs/centralized-systems/reference/adrs/ADR-594-bim-entity-persistence-hook-ssot.md
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { dequal } from 'dequal';

import type { AnySceneEntity } from '../../types/entities';
import { DXF_TIMING } from '../../config/dxf-timing';
import { EventBus } from '../../systems/events/EventBus';
import {
  resolveBimPersistenceScope,
  entityCreateScopeKey,
  type EntityCreateTargetScope,
} from '../../bim/persistence/bim-floor-scope';
import { mergeDocsIntoScene } from './merge-docs-into-scene';
import type { DocsMergeConfig } from './merge-docs-into-scene';
import { useBimFirestoreWriteGrace } from './useBimFirestoreWriteGrace';
import { createPersistSerializer } from './persist-serializer';
import { useBimEntityMovedPersistEffect } from './useBimEntityMovedPersistEffect';
import { useBimEntityRestoredPersistEffect } from './useBimEntityRestoredPersistEffect';
import type {
  BimEntityPersistenceParams,
  BimEntityPersistenceResult,
  BimEntitySaveState,
  BimPersistenceHookContext,
  BimPersistenceScope,
  CreateBimEntityPersistenceHookConfig,
} from './bim-entity-persistence-hook-types';

const AUTO_SAVE_DEBOUNCE_MS = DXF_TIMING.persist.ENTITY_AUTOSAVE; // ADR-516

/** Stable no-grace fn (used when `config.writeGrace` is off). */
const NEVER_IN_GRACE = (): boolean => false;
/** Stable no-op persist (used when the moved-effect is opted out). */
const NOOP_PERSIST = async (): Promise<void> => {};

/**
 * Build a `useXPersistence`-shaped hook from a per-entity config. Derived helpers
 * (default type guard / create trigger) are computed once at factory-call time.
 */
export function createBimEntityPersistenceHook<
  TService,
  TDoc extends { id: string },
  TEntity extends AnySceneEntity,
  TComparable,
  TContext = void,
  TExtra = undefined,
>(
  config: CreateBimEntityPersistenceHookConfig<
    TService,
    TDoc,
    TEntity,
    TComparable,
    TContext,
    TExtra
  >,
): (params: BimEntityPersistenceParams<TEntity>) => BimEntityPersistenceResult {
  const typeGuard =
    config.typeGuard ??
    ((e: AnySceneEntity): e is TEntity =>
      (e as { type?: string }).type === config.entityType);
  const createTrigger =
    config.createTrigger ?? { event: 'drawing:entity-created' as const, tool: config.entityType };
  // ADR-531 Φ5b.6 — primary + optional extra first-save triggers (ίδιος handler).
  const allCreateTriggers = [createTrigger, ...(config.extraCreateTriggers ?? [])];
  const movedEffectDisabled = config.enableMovedEffect === false;
  const useExtraHook = config.useExtra;

  return function useBimEntityPersistence(
    params: BimEntityPersistenceParams<TEntity>,
  ): BimEntityPersistenceResult {
    const {
      companyId,
      projectId,
      floorplanId,
      floorId,
      buildingId,
      userId,
      levelManager,
      primarySelected,
    } = params;

    const [saveState, setSaveState] = useState<BimEntitySaveState>('idle');
    const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);

    const serviceRef = useRef<TService | null>(null);
    const dirtyIdsRef = useRef<Set<string>>(new Set());
    const lastSavedParamsRef = useRef<Map<string, TComparable>>(new Map());
    const pendingFirstSaveIdsRef = useRef<Set<string>>(new Set());
    // ADR-635 Φ C.15 — first-save events that arrived before the async service was ready
    // (fresh-import-into-new-level race); flushed by the service-instantiation effect below.
    const deferredFirstSaveRef = useRef<Map<string, TEntity>>(new Map());
    // ADR-635 Φ C.16 — services for an EXPLICIT target scope that is not the live one
    // (import-into-another-storey). Cached per scope key so importing 117 hatches builds
    // ONE service, not 117.
    const scopedServiceCacheRef = useRef<Map<string, TService | null>>(new Map());
    const deletedIdsRef = useRef<Set<string>>(new Set());
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const selectedRef = useRef<TEntity | null>(null);
    selectedRef.current = primarySelected;

    const serializerRef = useRef(createPersistSerializer());
    const grace = useBimFirestoreWriteGrace();
    const effectiveIsWithinGrace = config.writeGrace ? grace.isWithinGrace : NEVER_IN_GRACE;

    // Per-entity extra ref bag — created once (slab/roof family-type link map).
    const extraRef = useRef<TExtra | null>(null);
    if (extraRef.current === null && config.createExtraRefs) {
      extraRef.current = config.createExtraRefs();
    }
    const extra = (extraRef.current ?? undefined) as TExtra;

    // ⚡ STABILITY (ca9): key the Firestore subscription off stable scope primitives
    // + `currentLevelId`, NOT the per-render `levelManager` object, so onSnapshot
    // does not unsubscribe/re-subscribe every render (target removed before ack →
    // `INTERNAL ASSERTION FAILED ca9 {ve:-1}`).
    const levelManagerRef = useRef(levelManager);
    levelManagerRef.current = levelManager;
    const currentLevelId = levelManager.currentLevelId;

    // Live scope, read at event time by persist/delete/restore + useExtra.
    const scopeRef = useRef<BimPersistenceScope>({
      companyId,
      projectId,
      floorplanId,
      buildingId,
      floorId,
      levelManager,
    });
    scopeRef.current = { companyId, projectId, floorplanId, buildingId, floorId, levelManager };
    // `userId` is not part of `BimPersistenceScope` (no lifecycle callback needs it) but
    // the scope resolver does — keep it event-time readable for Φ C.16 scoped writes.
    const userIdRef = useRef(userId);
    userIdRef.current = userId;

    // ---- Service instantiation (auth + scope ready) ------------------------
    useEffect(() => {
      // ADR-635 Φ C.16 — the explicitly-scoped services were built from THIS identity
      // (companyId/projectId/userId); drop them whenever it changes so a scope key can
      // never resolve to a service belonging to a previous tenant/session.
      scopedServiceCacheRef.current.clear();
      const scope = resolveBimPersistenceScope({ companyId, projectId, userId, floorId, floorplanId });
      if (!scope) {
        serviceRef.current = null;
        return;
      }
      // Pass the resolved scope through as-is: it is already shaped for the service
      // configs (`floorplanId` guaranteed, `floorId` omitted rather than nulled).
      // Re-spreading it field-by-field re-introduced a `floorId: undefined` key.
      serviceRef.current = config.createService(scope);

      // ADR-635 Φ C.15 — service is now ready: flush first-saves that arrived before it
      // existed (fresh-import race). Their ids are already in `pending` (merge-drop
      // protection), so the entity stayed visible until this write lands.
      const deferred = deferredFirstSaveRef.current;
      if (deferred.size > 0) {
        const queued = [...deferred.values()];
        deferred.clear();
        for (const e of queued) void persist(e);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [companyId, projectId, floorplanId, floorId, userId]);

    // ---- Subscribe + diff-merge (keyed on stable primitives only) ----------
    useEffect(() => {
      const svc = serviceRef.current;
      const levelId = currentLevelId;
      if (!svc || !levelId) return;

      const unsubscribe = config.service.subscribe(
        svc,
        (docs) => {
          if (config.merge.mode === 'generic') {
            const rawCfg = config.merge.config;
            const mergeConfig: DocsMergeConfig<TDoc, TEntity, TComparable, TContext> =
              typeof rawCfg === 'function'
                ? rawCfg(extraRef.current as TExtra)
                : rawCfg;
            mergeDocsIntoScene<TDoc, TEntity, TComparable, TContext>(
              docs as readonly TDoc[],
              levelId,
              levelManagerRef.current,
              mergeConfig,
              {
                dirty: dirtyIdsRef.current,
                deleted: deletedIdsRef.current,
                pending: pendingFirstSaveIdsRef.current,
                isWithinGrace: effectiveIsWithinGrace,
                lastSavedBaseline: lastSavedParamsRef.current,
              },
            );
          } else {
            config.merge.run(
              docs as readonly TDoc[],
              levelId,
              levelManagerRef.current,
              {
                dirty: dirtyIdsRef.current,
                deleted: deletedIdsRef.current,
                pending: pendingFirstSaveIdsRef.current,
                lastSavedParams: lastSavedParamsRef.current,
                isWithinGrace: effectiveIsWithinGrace,
              },
              extraRef.current as TExtra,
            );
          }
        },
        (err: Error) => {
          setError(err.message);
          setSaveState('error');
        },
      );
      return () => unsubscribe();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentLevelId, companyId, projectId, floorplanId, floorId, userId]);

    /**
     * Post-write bookkeeping SSoT: the entity is now the committed baseline, so it is
     * neither dirty nor awaiting its first save, and (when enabled) its write is graced
     * against the echo snapshot. Shared by every write path — normal persist, Φ C.16
     * explicitly-scoped first-save, and undo-restore — so a future change to what
     * "saved" means cannot drift between them (N.18: one copy, not three).
     */
    const recordSaved = (entity: TEntity): void => {
      lastSavedParamsRef.current.set(entity.id, config.entityComparable(entity));
      if (config.writeGrace) grace.recordWrite(entity.id);
      dirtyIdsRef.current.delete(entity.id);
      pendingFirstSaveIdsRef.current.delete(entity.id);
    };

    // ---- Immediate persist (auto-save flush + explicit + first-save) -------
    const persistOnce = useCallback(async (entity: TEntity) => {
      const svc = serviceRef.current;
      if (!svc) return;
      // Race guard (delete-wins, mep-segment): the entity was tombstoned before this
      // persist ran — writing now would resurrect a Firestore zombie. Skip entirely.
      if (config.raceGuardDelete && deletedIdsRef.current.has(entity.id)) return;
      const prevComparable = lastSavedParamsRef.current.get(entity.id) ?? null;
      const isNew = prevComparable === null;
      // Async pre-save transform / side-effect (opening mark alloc + kind re-sync;
      // wall soft-lock acquire). Returns the entity to actually persist.
      const toSave = config.beforeSave
        ? await config.beforeSave(entity, { isNew, prevComparable, scope: scopeRef.current, extra })
        : entity;
      setSaveState('saving');
      setError(null);
      try {
        if (isNew || config.neverUpdate) await config.service.save(svc, toSave);
        else await config.service.update(svc, toSave);
        // Race guard (delete raced AHEAD while the write was in-flight): the delete's
        // `remove` ran before this write landed, so it deleted nothing and our write is
        // now a zombie. Compensate by deleting the doc we just wrote; skip bookkeeping
        // (the delete handler already recorded audit/BOQ).
        if (config.raceGuardDelete && deletedIdsRef.current.has(toSave.id)) {
          await config.service.remove(svc, toSave.id);
          return;
        }
        recordSaved(toSave);
        setSaveState('saved');
        setLastSavedAt(Date.now());
        config.onPersisted?.(toSave, {
          isNew,
          prevComparable,
          scope: scopeRef.current,
          extra,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : config.saveErrorKey);
        setSaveState('error');
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Serialised persist (ADR-401 / N.7) — chains concurrent saves per id so a
    // same-tick create+attach re-persist sees the committed baseline.
    const persist = useCallback(
      (entity: TEntity): Promise<void> =>
        config.serialize
          ? serializerRef.current.run(entity.id, () => persistOnce(entity))
          : persistOnce(entity),
      [persistOnce],
    );

    // ---- First-save into an EXPLICIT target scope (ADR-635 Φ C.16) ---------
    /**
     * Write a freshly-created entity to the floor the ACTION declared, bypassing the
     * live (active-level) service entirely.
     *
     * 🛡️ WHY: `serviceRef` is rebuilt by an effect keyed on the ACTIVE floor. An import
     * resolves its target level up-front, then emits create-events synchronously after a
     * variable-duration parse — so at emit time the live service may still point at the
     * PREVIOUS storey. It is not null (Φ C.15 would have caught that); it is simply
     * WRONG, and the write succeeds into the wrong scope. Resolving the scope here makes
     * the write independent of React effect timing: the race is removed, not narrowed.
     *
     * Same shape as `foundation-cross-level-writer` (ADR-459) / `stairwell-opening-
     * cross-level-writer` (ADR-632) — build a service for the target scope and save
     * directly. Like them it skips `beforeSave` (its hooks — wall soft-lock, opening mark
     * alloc — are bound to the ACTIVE floor's scene and would be meaningless, or wrong,
     * against another storey). `onPersisted` DOES run, carrying the scope actually
     * written, so audit/BOQ stay correct.
     */
    const persistToScope = useCallback(async (entity: TEntity, target: EntityCreateTargetScope) => {
      const live = scopeRef.current;
      const cacheKey = `${target.floorId ?? ''}|${target.floorplanId ?? ''}`;
      let svc = scopedServiceCacheRef.current.get(cacheKey);
      if (svc === undefined) {
        const resolved = resolveBimPersistenceScope({
          companyId: live.companyId,
          projectId: live.projectId,
          userId: userIdRef.current,
          floorId: target.floorId,
          floorplanId: target.floorplanId,
        });
        svc = resolved ? config.createService(resolved) : null;
        scopedServiceCacheRef.current.set(cacheKey, svc);
      }
      if (!svc) {
        // Unresolvable target scope — fall back to the live path rather than dropping the
        // save (Φ C.15 deferral still protects it if the live service is not ready).
        if (!serviceRef.current) {
          deferredFirstSaveRef.current.set(entity.id, entity);
          return;
        }
        await persist(entity);
        return;
      }
      try {
        await config.service.save(svc, entity);
        recordSaved(entity);
        config.onPersisted?.(entity, {
          isNew: true,
          prevComparable: null,
          scope: { ...live, floorId: target.floorId, floorplanId: target.floorplanId },
          extra,
        });
      } catch (err) {
        // Keep `pending`/`dirty` set on failure: the entity stays protected from the
        // snapshot merge's orphan-drop and the next edit re-saves it.
        setError(err instanceof Error ? err.message : config.saveErrorKey);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [persist]);

    // ---- Shared dirty-gate + debounce scheduler ----------------------------
    // SSoT for the auto-save gate, used by the selected-entity effect (majority)
    // and, for event-driven entities (mep-segment), the params-updated listener.
    const scheduleAutoSave = useCallback((entity: TEntity | null) => {
      if (!entity || !serviceRef.current) return;
      const known = lastSavedParamsRef.current.has(entity.id);
      const pending = pendingFirstSaveIdsRef.current.has(entity.id);
      if (!known && !pending) return;
      const lastSaved = lastSavedParamsRef.current.get(entity.id);
      const isDirty = config.autoSaveDirty
        ? config.autoSaveDirty(entity, lastSaved, extra)
        : !(lastSaved !== undefined && dequal(lastSaved, config.entityComparable(entity)));
      if (!isDirty) return;

      dirtyIdsRef.current.add(entity.id);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        void persist(entity);
      }, AUTO_SAVE_DEBOUNCE_MS);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [persist]);

    // ---- Auto-save debounce on selected-entity params change ---------------
    // Skipped for event-driven entities (`autoSaveTrigger`); they pass no selection.
    useEffect(() => {
      if (config.autoSaveTrigger) return;
      scheduleAutoSave(primarySelected);
      return () => {
        if (saveTimerRef.current) {
          clearTimeout(saveTimerRef.current);
          saveTimerRef.current = null;
        }
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [primarySelected, scheduleAutoSave]);

    // ---- Event-driven auto-save (mep-segment: bim:mep-segment-params-updated) --
    useEffect(() => {
      const trig = config.autoSaveTrigger;
      if (!trig) return;
      const cleanup = EventBus.on(trig.event, (payload) => {
        const id = trig.getId(payload);
        if (!id) return;
        const lm = levelManagerRef.current;
        const levelId = lm.currentLevelId;
        if (!levelId) return;
        const found = lm.getLevelScene(levelId)?.entities.find((e) => e.id === id);
        if (!found || !typeGuard(found)) return;
        scheduleAutoSave(found);
      });
      return cleanup;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scheduleAutoSave]);

    const saveNow = useCallback(async () => {
      const entity = selectedRef.current;
      if (!entity) return;
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      await persist(entity);
    }, [persist]);

    // ---- Delete: remove from Firestore + scene + lifecycle side-effect -----
    const deleteEntity = useCallback(async (id: string) => {
      const svc = serviceRef.current;
      if (!svc) return;
      const lm = levelManagerRef.current;
      const levelId = lm.currentLevelId;
      if (!levelId) return;

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }

      const scene = lm.getLevelScene(levelId);
      const found = scene?.entities.find((e) => e.id === id);
      const deletedTyped = found && typeGuard(found) ? found : null;

      const removeFromScene = (): void => {
        if (scene) {
          lm.setLevelScene(levelId, {
            ...scene,
            entities: scene.entities.filter((e) => e.id !== id),
          });
        }
      };

      // Google-level OPTIMISTIC UPDATE (N.7): some entities (column) remove from the
      // scene SYNCHRONOUSLY before the network await so same-event structural
      // reactions see a fresh scene; most remove after the await.
      if (config.sceneRemovalTiming === 'before') {
        removeFromScene();
        // Wall: recompute neighbour miter/bevel trims now the wall is gone, before
        // the await, so coalesced structural reactions read the fresh scene.
        config.onAfterOptimisticRemoval?.(id, extra);
      }

      try {
        await config.service.remove(svc, id);
        config.onDeleted?.(id, deletedTyped, {
          scope: scopeRef.current,
          extra,
          lastSavedComparable: lastSavedParamsRef.current.get(id) ?? null,
        });
      } catch {
        // Non-fatal: deletion failure silent — user retries.
      }

      if (config.sceneRemovalTiming !== 'before') removeFromScene();

      dirtyIdsRef.current.delete(id);
      lastSavedParamsRef.current.delete(id);
      pendingFirstSaveIdsRef.current.delete(id);
      deletedIdsRef.current.add(id);
      config.onDeleteCleanup?.(id, extra);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ---- persistRestore: undo→Firestore re-create -------------------------
    // Shared save + baseline/grace/dirty/pending bookkeeping (both restore modes).
    const commitRestoreWrite = async (svc: TService, entity: TEntity): Promise<void> => {
      await config.service.save(svc, entity);
      recordSaved(entity);
    };
    const persistRestore = useCallback(async (entity: TEntity) => {
      const svc = serviceRef.current;
      if (!svc) return;
      // Lean restore (thermal-space / space-separator / floor-finish / wall-covering):
      // save + bookkeeping only, no state transitions.
      if (config.restoreSilent) {
        await commitRestoreWrite(svc, entity);
        return;
      }
      setSaveState('saving');
      setError(null);
      try {
        await commitRestoreWrite(svc, entity);
        setSaveState('saved');
        setLastSavedAt(Date.now());
        config.onRestored?.(entity, { scope: scopeRef.current, extra });
      } catch (err) {
        setError(err instanceof Error ? err.message : config.restoreErrorKey);
        setSaveState('error');
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ---- First-save listener (drawing:entity-created | drawing:complete [+ extras]) ---
    useEffect(() => {
      const cleanups = allCreateTriggers.map((trigger) =>
        EventBus.on(trigger.event, (payload) => {
          const p = payload as { tool?: string; entity?: AnySceneEntity; scope?: EntityCreateTargetScope };
          if (p.tool !== trigger.tool) return;
          const entity = p.entity as TEntity | undefined;
          if (!entity || (entity as { type?: string }).type !== config.entityType) return;
          // Protect from the snapshot merge's orphan-drop REGARDLESS of service readiness
          // (dropOrphan keeps pending/dirty ids). A create-event can arrive BEFORE the async
          // service-instantiation effect runs — a fresh DXF import emits `drawing:entity-created`
          // synchronously (useSceneState) before this hook re-rendered with the imported level's
          // scope. Without this, the subscription's first (docless) snapshot dropped the freshly
          // imported entity → "appears then vanishes" (repro: imported AutoCAD hatch beside a
          // block, ADR-635 Φ C.15). Previously this path early-returned on `!serviceRef.current`,
          // silently losing both the protection AND the first-save.
          pendingFirstSaveIdsRef.current.add(entity.id);
          dirtyIdsRef.current.add(entity.id);
          // ADR-635 Φ C.16 — an EXPLICIT target scope beats the live one. Only when it
          // actually resolves to a DIFFERENT floor: same-floor creations keep the normal
          // path (serializer + beforeSave + full bookkeeping), so interactive drawing —
          // which never sets `scope` — is byte-for-byte unchanged.
          const target = p.scope;
          if (target) {
            const targetKey = entityCreateScopeKey(target);
            if (targetKey && targetKey !== entityCreateScopeKey(scopeRef.current)) {
              void persistToScope(entity, target);
              return;
            }
          }
          if (!serviceRef.current) {
            // Service not ready — defer; the instantiation effect flushes it once scoped.
            deferredFirstSaveRef.current.set(entity.id, entity);
            return;
          }
          void persist(entity);
        }),
      );
      return () => { for (const c of cleanups) c(); };
    }, [persist, persistToScope]);

    // ---- Delete-requested listener (optional — floorplan-symbol has none) --
    useEffect(() => {
      const dt = config.deleteTrigger;
      if (!dt) return;
      const cleanup = EventBus.on(dt.event, (payload) => {
        const id = dt.getId(payload);
        if (!id) return;
        // wall / opening / mep-segment mark the tombstone SYNCHRONOUSLY here so an
        // incoming snapshot mid-delete never re-adds the entity (and, for mep-segment,
        // an in-flight first-save detects the race). deleteEntity re-adds it (Set).
        if (config.markDeletedOnRequest) deletedIdsRef.current.add(id);
        void deleteEntity(id);
      });
      return cleanup;
    }, [deleteEntity]);

    useBimEntityMovedPersistEffect(
      typeGuard,
      serviceRef,
      dirtyIdsRef,
      movedEffectDisabled ? NOOP_PERSIST : persist,
    );
    useBimEntityRestoredPersistEffect(
      config.restoreEntityType,
      typeGuard,
      serviceRef,
      pendingFirstSaveIdsRef,
      deletedIdsRef,
      persistRestore,
    );

    // ---- Single escape hatch for per-entity extra effects ------------------
    const extraCtx: BimPersistenceHookContext<TEntity, TComparable, TExtra> = {
      serviceRef: serviceRef as unknown as MutableRefObject<unknown>,
      dirtyIdsRef,
      pendingFirstSaveIdsRef,
      deletedIdsRef,
      lastSavedParamsRef,
      levelManagerRef,
      persist,
      primarySelected,
      scope: scopeRef.current,
      scopeRef,
      extra,
    };
    // Stable per generated hook (config.useExtra is a module constant) → rules-of-hooks safe.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useExtraHook?.(extraCtx);

    // ---- Unmount cleanup — flush pending timers ----------------------------
    useEffect(() => {
      return () => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      };
    }, []);

    return useMemo(
      () => ({ saveState, lastSavedAt, error, saveNow, deleteEntity }),
      [saveState, lastSavedAt, error, saveNow, deleteEntity],
    );
  };
}
