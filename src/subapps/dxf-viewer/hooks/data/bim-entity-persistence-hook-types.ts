'use client';

/**
 * ADR-594 — Config contract for `createBimEntityPersistenceHook`.
 *
 * TYPES-ONLY module (no logic → exempt from the 500-line rule, N.7.1). It declares
 * the parameterised surface that collapses the ~21 byte-identical BIM entity
 * Firestore persistence hooks (`useBeamPersistence` … `useMepBoilerPersistence`)
 * onto ONE generic factory. The invariant scaffold (state / refs / scope-effect /
 * ca9-stable subscribe / debounced autosave / saveNow / delete / persistRestore /
 * created+delete listeners / moved+restored effects / unmount flush / memoised
 * return) lives once in the factory; per-entity variance is expressed here as a
 * **minimal required core + optional overrides with sane defaults + a single
 * `useExtra` escape hatch** (big-player "shared primitive + per-instance binding",
 * NOT a god-config).
 *
 * The former "divergent members" (`useWallPersistence` / `useOpeningPersistence` /
 * `useMepSegmentPersistence`) are now ALSO expressed here (ADR-594 Phase 2) via three
 * additive, behaviour-neutral core hooks — `beforeSave` (async pre-save transform /
 * side-effect: opening mark alloc + kind re-sync, wall soft-lock acquire), `raceGuardDelete`
 * (mep-segment delete-wins guard) and `autoSaveTrigger` (event-driven autosave). Each
 * defaults to off, so the ~21 majority hooks stay byte-identical.
 *
 * @see ./create-bim-entity-persistence-hook.ts — the factory
 * @see docs/centralized-systems/reference/adrs/ADR-594-bim-entity-persistence-hook-ssot.md
 */

import type { MutableRefObject } from 'react';
import type { AnySceneEntity, SceneModel } from '../../types/entities';
import type { LevelSceneWriter } from '../../systems/levels/level-scene-accessor';
import type { BimEventMap } from '../../systems/events/drawing-event-map-bim';
import type {
  DocsMergeConfig,
  DocsMergeLevelManager,
  DocsMergeRefs,
} from './merge-docs-into-scene';

// ============================================================================
// STATE
// ============================================================================

export type BimEntitySaveState = 'idle' | 'saving' | 'saved' | 'error';

/** Restore-able BIM entity discriminant (derived from the canonical event SSoT). */
export type BimRestoreEntityType = BimEventMap['bim:entity-restore-requested']['entityType'];

// ============================================================================
// RUNTIME SCOPE (values threaded to lifecycle callbacks)
// ============================================================================

/** Live scope values a lifecycle callback needs (BOQ feed, cross-entity emits). */
export interface BimPersistenceScope {
  readonly companyId: string | null;
  readonly projectId: string | null | undefined;
  readonly floorplanId: string | null | undefined;
  readonly buildingId?: string | null;
  readonly floorId?: string | null;
  readonly levelManager: LevelSceneWriter;
}

// ============================================================================
// CANONICAL HOOK PARAMS + RESULT (thin per-entity wrappers re-map the names)
// ============================================================================

export interface BimEntityPersistenceParams<TEntity extends AnySceneEntity> {
  readonly companyId: string | null;
  readonly projectId: string | null | undefined;
  readonly floorplanId: string | null | undefined;
  readonly floorId?: string | null;
  readonly buildingId?: string | null;
  readonly userId: string | null;
  readonly levelManager: LevelSceneWriter;
  readonly primarySelected: TEntity | null;
}

export interface BimEntityPersistenceResult {
  readonly saveState: BimEntitySaveState;
  readonly lastSavedAt: number | null;
  readonly error: string | null;
  readonly saveNow: () => Promise<void>;
  readonly deleteEntity: (id: string) => Promise<void>;
}

// ============================================================================
// EXTRA-EFFECT ESCAPE HATCH CONTEXT
// ============================================================================

/**
 * Context handed to `useExtra` (the single escape hatch) and to lifecycle
 * callbacks that need refs. Everything the invariant scaffold owns is exposed so a
 * per-entity extra effect (e.g. `bim:beam-params-updated` immediate persist, a
 * slab BOQ re-feed listener, a family-type re-resolution hook) can be wired
 * without re-implementing the scaffold.
 */
export interface BimPersistenceHookContext<
  TEntity extends AnySceneEntity,
  TComparable,
  TExtra,
> {
  readonly serviceRef: MutableRefObject<unknown>;
  readonly dirtyIdsRef: MutableRefObject<Set<string>>;
  readonly pendingFirstSaveIdsRef: MutableRefObject<Set<string>>;
  readonly deletedIdsRef: MutableRefObject<Set<string>>;
  readonly lastSavedParamsRef: MutableRefObject<Map<string, TComparable>>;
  readonly levelManagerRef: MutableRefObject<LevelSceneWriter>;
  /** Serialized, idempotent persist (auto-save flush + explicit + first-save). */
  readonly persist: (entity: TEntity) => Promise<void>;
  /** Primary-selected entity this render (wall soft-lock lifecycle needs it). */
  readonly primarySelected: TEntity | null;
  /** Current scope snapshot (this render). */
  readonly scope: BimPersistenceScope;
  /** Live scope ref — read `.current` at event time inside `useExtra` listeners. */
  readonly scopeRef: MutableRefObject<BimPersistenceScope>;
  /** Per-entity extra ref bag (`createExtraRefs`), else `undefined`. */
  readonly extra: TExtra;
}

// ============================================================================
// LIFECYCLE CALLBACK PAYLOADS (audit + BOQ + cross-entity emits live here)
// ============================================================================

export interface OnPersistedInfo<TComparable, TExtra> {
  readonly isNew: boolean;
  readonly prevComparable: TComparable | null;
  readonly scope: BimPersistenceScope;
  readonly extra: TExtra;
}

/**
 * Info handed to `beforeSave` — the async pre-save transform / side-effect that runs
 * INSIDE persist, before the Firestore write (opening mark alloc + kind re-sync; wall
 * soft-lock acquire). Same shape as `OnPersistedInfo` (pre-write knowledge only).
 */
export type BeforeSaveInfo<TComparable, TExtra> = OnPersistedInfo<TComparable, TExtra>;

/**
 * Event-driven auto-save trigger (mep-segment: `bim:mep-segment-params-updated`). When
 * set, the selected-entity debounce is replaced by a params-updated listener that
 * resolves the entity from the live scene and feeds the SAME dirty-gate + debounce
 * scheduler (no duplicated logic). The wrapper passes `primarySelected: null`.
 */
export interface AutoSaveTrigger {
  readonly event: keyof BimEventMap;
  /** Extract the entity id from the params-updated payload. */
  readonly getId: (payload: unknown) => string | undefined;
}

export interface OnDeletedInfo<TComparable, TExtra> {
  readonly scope: BimPersistenceScope;
  readonly extra: TExtra;
  /** Last-persisted comparable for this id (baseline), read before it is cleared —
   *  opening audit/BOQ prefer it over the (possibly locally-edited) scene params. */
  readonly lastSavedComparable: TComparable | null;
}

export interface OnRestoredInfo<TExtra> {
  readonly scope: BimPersistenceScope;
  readonly extra: TExtra;
}

// ============================================================================
// MERGE STRATEGY (generic SSoT config OR a bespoke merge helper)
// ============================================================================

/** Feed the generic `mergeDocsIntoScene` SSoT with a per-entity adapter. The config
 *  may be static OR built per-instance from the extra ref bag (slab/roof family-type
 *  link map is seeded by `seedExtraBaseline` into `extra`). */
export interface GenericMergeStrategy<
  TDoc extends { id: string },
  TEntity extends AnySceneEntity,
  TComparable,
  TContext = void,
  TExtra = undefined,
> {
  readonly mode: 'generic';
  readonly config:
    | DocsMergeConfig<TDoc, TEntity, TComparable, TContext>
    | ((extra: TExtra) => DocsMergeConfig<TDoc, TEntity, TComparable, TContext>);
}

/**
 * Bespoke merge helper (Column uses `mergeColumnDocsIntoScene`; Opening uses
 * `mergeOpeningDocsIntoScene`). Still centralised on `mergeDocsIntoScene` internally —
 * this only lets a hook pass its pre-built helper that owns a wider ref bag (e.g.
 * `lastSavedType`, `lastSavedLink`), read from the per-instance `extra` ref bag.
 */
export interface CustomMergeStrategy<TDoc extends { id: string }, TComparable, TExtra = undefined> {
  readonly mode: 'custom';
  readonly run: (
    docs: readonly TDoc[],
    levelId: string,
    lm: DocsMergeLevelManager,
    refs: CustomMergeRefs<TComparable>,
    extra: TExtra,
  ) => void;
}

/** Ref bag exposed to a `CustomMergeStrategy.run`. */
export interface CustomMergeRefs<TComparable> {
  readonly dirty: Set<string>;
  readonly deleted: Set<string>;
  readonly pending: Set<string>;
  readonly lastSavedParams: Map<string, TComparable>;
  readonly isWithinGrace: (id: string) => boolean;
}

export type BimMergeStrategy<
  TDoc extends { id: string },
  TEntity extends AnySceneEntity,
  TComparable,
  TContext = void,
  TExtra = undefined,
> =
  | GenericMergeStrategy<TDoc, TEntity, TComparable, TContext, TExtra>
  | CustomMergeStrategy<TDoc, TComparable, TExtra>;

// ============================================================================
// SERVICE ADAPTER (decouples the per-service method names)
// ============================================================================

/**
 * Thin adapters over a per-entity Firestore service. Encapsulate the method-name
 * variance (`saveColumn` vs `saveBeam`, `subscribeColumns` vs `subscribeBeams`,
 * …) and the `entityToSaveInput` mapping — the factory calls these, never the raw
 * service methods.
 */
export interface BimEntityServiceAdapter<TService, TEntity extends AnySceneEntity> {
  /** First-write path (setDoc). Owns `entityToSaveInput`. */
  readonly save: (svc: TService, entity: TEntity) => Promise<void>;
  /** Re-edit path (updateDoc). Owns the per-entity update patch. */
  readonly update: (svc: TService, entity: TEntity) => Promise<void>;
  readonly remove: (svc: TService, id: string) => Promise<void>;
  /** Subscribe to docs; returns the unsubscribe fn. */
  readonly subscribe: (
    svc: TService,
    onDocs: (docs: readonly unknown[]) => void,
    onError: (err: Error) => void,
  ) => () => void;
}

// ============================================================================
// FIRST-SAVE / DELETE EVENT TRIGGERS
// ============================================================================

/** `drawing:entity-created` (default) or `drawing:complete` (hatch). */
export type CreateTriggerEvent = 'drawing:entity-created' | 'drawing:complete';

export interface DeleteTrigger {
  readonly event: keyof BimEventMap;
  /** Extract the entity id from the delete-requested payload. */
  readonly getId: (payload: unknown) => string | undefined;
}

// ============================================================================
// SCOPE-KEYED SERVICE FACTORY
// ============================================================================

export interface ResolvedBimScope {
  readonly companyId: string;
  readonly projectId: string;
  readonly floorplanId: string | null;
  readonly floorId: string | null;
  readonly userId: string;
}

// ============================================================================
// THE CONFIG
// ============================================================================

/**
 * `createBimEntityPersistenceHook(config)` contract.
 *
 * REQUIRED (the genuine per-instance binding): `entityType`, `restoreEntityType`,
 * `createService`, `service`, `merge`, `entityComparable`, error keys.
 * Everything else is OPTIONAL with a sane default that reproduces the majority
 * scaffold byte-for-byte.
 */
export interface CreateBimEntityPersistenceHookConfig<
  TService,
  TDoc extends { id: string },
  TEntity extends AnySceneEntity,
  TComparable,
  TContext = void,
  TExtra = undefined,
> {
  // -- Identity --------------------------------------------------------------
  /** Discriminant string (`entity.type` literal). Drives the default typeGuard,
   *  create-tool match, and diagnostics. */
  readonly entityType: string;
  /** Restore-effect discriminant (`bim:entity-restore-requested` union member). */
  readonly restoreEntityType: BimRestoreEntityType;
  /** Server-side developer error strings (N.11-exempt — not user-facing i18n). */
  readonly saveErrorKey: string;
  readonly restoreErrorKey: string;

  // -- Service ---------------------------------------------------------------
  readonly createService: (scope: ResolvedBimScope) => TService | null;
  readonly service: BimEntityServiceAdapter<TService, TEntity>;

  // -- Scene reconciliation --------------------------------------------------
  readonly merge: BimMergeStrategy<TDoc, TEntity, TComparable, TContext, TExtra>;
  /** Comparable used for the auto-save baseline + dirty gate (usually `e.params`;
   *  hatch: `pickHatchData(e)`). MUST match the merge `docComparable` shape. */
  readonly entityComparable: (entity: TEntity) => TComparable;

  // -- Optional behaviour toggles (defaults reproduce the majority) ----------
  /** Default: `(e) => e.type === entityType`. */
  readonly typeGuard?: (e: AnySceneEntity) => e is TEntity;
  /** Use the post-write grace window (suppress stale ca9 snapshots). Default false. */
  readonly writeGrace?: boolean;
  /** Serialise concurrent persists per id (create+move same tick). Default false. */
  readonly serialize?: boolean;
  /** Wire `useBimEntityMovedPersistEffect`. Default true. */
  readonly enableMovedEffect?: boolean;
  /** setDoc even on re-edit (no update path). Slab / slab-opening. Default false. */
  readonly neverUpdate?: boolean;
  /** Lean restore (save + bookkeeping only, no saveState/lastSavedAt/error/onRestored)
   *  — thermal-space / space-separator / floor-finish / wall-covering. Default false. */
  readonly restoreSilent?: boolean;
  /** Optimistic scene removal timing on delete. Default 'after'. */
  readonly sceneRemovalTiming?: 'before' | 'after';
  /** Synchronous side-effect right AFTER an optimistic (`'before'`) scene removal,
   *  before the network await — e.g. wall neighbour-miter trim recompute, so coalesced
   *  structural reactions on the same delete event see the fresh scene. */
  readonly onAfterOptimisticRemoval?: (id: string, extra: TExtra) => void;
  /** First-save trigger. Default `{ event: 'drawing:entity-created', tool: entityType }`. */
  readonly createTrigger?: { readonly event: CreateTriggerEvent; readonly tool: string };
  /** Delete-requested listener. Omit for entities with no in-app delete yet
   *  (floorplan-symbol). */
  readonly deleteTrigger?: DeleteTrigger;
  /** Auto-save dirty predicate. Default `!dequal(lastSaved, entityComparable(entity))`. */
  readonly autoSaveDirty?: (
    entity: TEntity,
    lastSaved: TComparable | undefined,
    extra: TExtra,
  ) => boolean;

  // -- Divergent-member hooks (ADR-594 Phase 2 — off by default) --------------
  /**
   * Async pre-save transform / side-effect run INSIDE persist, before the Firestore
   * write. Returns the entity to actually persist (may be re-derived). Opening: mark
   * allocation on first save + kind→mark re-sync on edit. Wall: soft-lock acquire
   * (returns the entity unchanged). Default: identity (no transform).
   */
  readonly beforeSave?: (
    entity: TEntity,
    info: BeforeSaveInfo<TComparable, TExtra>,
  ) => Promise<TEntity>;
  /**
   * Delete-wins race guard (mep-segment): skip the write if the entity was tombstoned
   * before persist ran, and compensate (delete the doc) if a delete raced ahead while
   * the write was in-flight — preventing a resurrected Firestore zombie. Default false.
   */
  readonly raceGuardDelete?: boolean;
  /**
   * Mark the tombstone SYNCHRONOUSLY in the delete-requested listener, before the async
   * deleteEntity — so an incoming snapshot mid-delete never re-adds the entity (wall /
   * opening / mep-segment). Independent of `raceGuardDelete` (persist-level). Default false.
   */
  readonly markDeletedOnRequest?: boolean;
  /**
   * Event-driven auto-save (mep-segment) instead of the selected-entity debounce. The
   * wrapper passes `primarySelected: null`; this listener feeds the same scheduler.
   */
  readonly autoSaveTrigger?: AutoSaveTrigger;

  // -- Extra state + escape hatch --------------------------------------------
  /** Per-entity extra ref bag (e.g. slab/roof family-type link map). */
  readonly createExtraRefs?: () => TExtra;
  /** Single escape hatch for per-entity effects (params-updated immediate persist,
   *  cross-entity BOQ re-feed listeners, family-type re-resolution). MUST call
   *  hooks unconditionally (it is invoked once per render with a stable ref). */
  readonly useExtra?: (ctx: BimPersistenceHookContext<TEntity, TComparable, TExtra>) => void;

  // -- Lifecycle side-effects (audit + BOQ + cross-entity emits) -------------
  readonly onPersisted?: (entity: TEntity, info: OnPersistedInfo<TComparable, TExtra>) => void;
  /** Inside the delete try-block (after `service.remove`) — audit + BOQ + emits. */
  readonly onDeleted?: (id: string, deleted: TEntity | null, info: OnDeletedInfo<TComparable, TExtra>) => void;
  /** Unconditional post-delete extra cleanup (runs even if `service.remove` throws) —
   *  e.g. clear the slab/roof family-type link map entry. */
  readonly onDeleteCleanup?: (id: string, extra: TExtra) => void;
  readonly onRestored?: (entity: TEntity, info: OnRestoredInfo<TExtra>) => void;
}

// Re-export merge helper types so call-sites import from one place.
export type { DocsMergeConfig, DocsMergeRefs, SceneModel };
