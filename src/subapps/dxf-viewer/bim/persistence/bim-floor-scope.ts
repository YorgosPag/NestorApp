'use client';

/**
 * ADR-420 — BIM floor-scope SSoT.
 *
 * Single source of truth for how EVERY BIM entity (`floorplan_walls`,
 * `floorplan_slabs`, `floorplan_columns`, … all 20 collections) is scoped to a
 * floor in Firestore.
 *
 * ## The problem this solves
 * Historically all BIM persistence services queried `where('floorplanId','==',
 * fileRecordId)`. `floorplanId` === `levelManager.fileRecordId` — the cadFiles
 * id of the *currently loaded DXF file*, which is **regenerated on every
 * re-import**. So re-importing a floor's plan orphaned every wall/slab/column
 * already drawn on that floor (the subscription pointed at the new, empty file
 * id). See ADR-420 root-cause analysis.
 *
 * ## The fix — stable identity key
 * BIM entities are scoped to the **building storey id** (`floorId`, `flr_*` =
 * IfcBuildingStorey). Unlike `floorplanId` (volatile file id) and `layerId`/
 * `levelId` (volatile DXF-viewer level id, regenerated on level delete+
 * recreate), `floorId` is a durable building-management identity that survives
 * re-import, file re-upload and level recreation (ADR-179 IFC hierarchy,
 * ADR-399 floor tabs).
 *
 * `floorplanId` is still written on every doc — but only as **provenance**
 * (which physical DXF file the entity came from), never again as the scope key.
 *
 * ## Fallback
 * Project / building-level canvases have no `floorId` (they are not storeys and
 * are not re-imported per-floor). For those the legacy `floorplanId` key is
 * used — `resolveBimScope` degrades gracefully so non-floor canvases keep
 * working unchanged.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-420-bim-floor-scope-ssot.md
 * @see docs/centralized-systems/reference/adrs/ADR-355-realtime-subscription-ssot-consolidation.md
 */

import { where, type QueryConstraint } from 'firebase/firestore';

/**
 * The minimal scope inputs every BIM `*FirestoreServiceConfig` must carry.
 * `floorId` is optional: present on floor-level canvases (the common case),
 * absent on project/building-level canvases (legacy `floorplanId` fallback).
 */
export interface BimScopeConfig {
  readonly projectId: string;
  /** Provenance — the source DXF FileRecord id. Always stored, never the scope key (when floorId exists). */
  readonly floorplanId: string;
  /** Stable building-storey id (`flr_*`, IfcBuildingStorey). The preferred scope key. */
  readonly floorId?: string;
}

/** Resolved scope: which field+value the Firestore query / write is keyed on. */
export interface BimFloorScope {
  readonly key: 'floorId' | 'floorplanId';
  readonly value: string;
}

/**
 * Resolve the stable scope key for a BIM entity. Prefers the durable `floorId`
 * (building storey); falls back to the legacy `floorplanId` only when no floor
 * is bound (project/building-level canvas).
 */
export function resolveBimScope(cfg: BimScopeConfig): BimFloorScope {
  if (cfg.floorId) return { key: 'floorId', value: cfg.floorId };
  return { key: 'floorplanId', value: cfg.floorplanId };
}

/**
 * Build the Firestore subscribe/query constraints for a BIM collection. The
 * tenant `companyId` constraint is auto-applied upstream by
 * `firestoreQueryService` (ADR-355) — do NOT add it here.
 *
 * Every BIM service's `subscribe*` method MUST build its constraints from this
 * helper (full SSoT — ends the 20× `where('floorplanId',…)` copy-paste).
 */
export function buildBimScopeConstraints(cfg: BimScopeConfig): QueryConstraint[] {
  const scope = resolveBimScope(cfg);
  return [
    where('projectId', '==', cfg.projectId),
    where(scope.key, '==', scope.value),
  ];
}

/**
 * The scope fields to persist on every BIM document. `floorplanId` is always
 * written (provenance); `floorId` is written whenever a floor is bound. Spread
 * into the service's `base` payload in place of the old hard-coded
 * `floorplanId: this.config.floorplanId` line.
 */
export function bimScopeWriteFields(cfg: BimScopeConfig): Record<string, string> {
  return {
    floorplanId: cfg.floorplanId,
    ...(cfg.floorId ? { floorId: cfg.floorId } : {}),
  };
}

/**
 * ADR-650 — SITE-level (project-wide) scope constraints.
 *
 * Unlike per-storey BIM entities (`buildBimScopeConstraints` → `projectId` +
 * `floorId`), some artefacts belong to the whole **site**, not a single storey:
 * the topographic survey (terrain) is the canonical case. In IFC the ground is
 * an `IfcSite` object owning every `IfcBuilding`/`IfcBuildingStorey`; Revit's
 * Toposurface and Civil 3D surfaces are likewise one site object visible on
 * every level. This app models **one `IfcSite` per project**
 * (`ifc-spatial-hierarchy.ts` builds a single site from the `Project`, with the
 * survey point living on the project) — so the site scope key is `projectId`.
 *
 * The subscription therefore keys on `projectId` ALONE (no floor constraint):
 * one doc per project, hydrated on every storey so the terrain shows everywhere.
 * `floorId`/`floorplanId` are still written on the doc, but only as provenance
 * (which storey/file the survey was captured on), never as the scope key.
 *
 * Tenant `companyId` is auto-applied upstream by `firestoreQueryService`
 * (ADR-355) — do NOT add it here.
 */
export function buildProjectScopeConstraints(projectId: string): QueryConstraint[] {
  return [where('projectId', '==', projectId)];
}

// ============================================================================
// PERSISTENCE-READY GATE (ADR-420 SSoT — incident 2026-06-16)
// ============================================================================

/**
 * Raw scope inputs a BIM persistence hook holds before it can instantiate its
 * Firestore service. Mirrors the props threaded by `DxfViewerTopBar`. All
 * fields are nullable because they originate from optional context.
 */
export interface BimPersistenceScopeInput {
  readonly companyId: string | null | undefined;
  readonly projectId: string | null | undefined;
  readonly userId: string | null | undefined;
  /** Durable building-storey id (`flr_*`) — the PREFERRED scope key (ADR-420). */
  readonly floorId?: string | null;
  /** Volatile source DXF FileRecord id — provenance / legacy fallback scope key. */
  readonly floorplanId?: string | null;
}

/**
 * A validated scope, shaped to drop straight into any `*FirestoreServiceConfig`.
 * `floorplanId` is GUARANTEED present (mirrors `floorId` when no DXF file is
 * bound) so the per-entity service configs (`floorplanId: string`) stay valid
 * unchanged; the Firestore query still keys on `floorId` whenever it exists
 * (`buildBimScopeConstraints` → `resolveBimScope`).
 */
export interface ResolvedBimPersistenceScope {
  readonly companyId: string;
  readonly projectId: string;
  readonly userId: string;
  readonly floorId?: string;
  readonly floorplanId: string;
}

/**
 * ADR-635 Φ C.16 — the target scope an entity-creation event may carry so the
 * write lands on the floor the ACTION meant, not on "whatever floor the user is
 * looking at when the listener runs".
 *
 * 🛡️ ROOT-CAUSE (incident 2026-07-20 — 117 imported hatches lost): a DXF import
 * resolves its `targetLevelId` explicitly (`useSceneState.handleFileImport`, per
 * ADR-420) and writes the scene to it — then emits `drawing:entity-created`
 * WITHOUT that scope. The ~30 persistence hosts all derive `floorId` from the
 * ACTIVE level (`DxfViewerTopBar`), which is updated through a React re-render +
 * effect, while the create-events fire synchronously after a variable-duration
 * `await importDxfFile`. Import the same file into two storeys and the hatches
 * (per-entity persisted, `floorplan_hatches`) landed in the previous storey's
 * scope; `reconcileLoadedSceneBim` then found no docs on the real target and
 * dropped them. Non-deterministic — a FASTER machine loses more.
 *
 * The principle (Revit / ArchiCAD / Figma): **a write never reads "what is the
 * user looking at now" — the scope travels with the action.** This is the same
 * conclusion `foundation-cross-level-writer` (ADR-459) and
 * `stairwell-opening-cross-level-writer` (ADR-632) already reached for their own
 * cross-level writes; Φ C.16 generalises it to the shared first-save path.
 *
 * `levelId` targets the SCENE, `floorId`/`floorplanId` target FIRESTORE — they
 * are separate identities (ADR-420: `floorId` durable, `floorplanId` volatile).
 */
export interface EntityCreateTargetScope {
  /** DXF-viewer level whose scene owns the entity (scene-side target). */
  readonly levelId: string;
  /** Durable building-storey id (`flr_*`) — the preferred Firestore scope key. */
  readonly floorId?: string | null;
  /** Source DXF FileRecord id — provenance / legacy fallback scope key. */
  readonly floorplanId?: string | null;
}

/**
 * The scope key a target resolves to (`floorId` preferred, `floorplanId`
 * fallback) — or `null` when neither is bound. Use it to decide whether an
 * explicit target actually differs from the live scope before paying for a
 * separately-scoped service.
 */
export function entityCreateScopeKey(
  scope: Pick<EntityCreateTargetScope, 'floorId' | 'floorplanId'>,
): string | null {
  return scope.floorId || scope.floorplanId || null;
}

/**
 * Single source of truth for the "is this BIM persistence service allowed to
 * instantiate?" gate — replaces the 26× copy-pasted
 * `if (!companyId || !projectId || !floorplanId || !userId) …` guard.
 *
 * 🛡️ ROOT-CAUSE FIX (incident 2026-06-16 — column/BIM not persisting on a floor
 * whose own DXF file was cross-linked): the old gate required `floorplanId`
 * (= `levelManager.fileRecordId`), a VOLATILE value the cross-floor guard nulls
 * out (`useLevelSceneLoader.resetDxfAutoSaveTarget`). Per ADR-420 the durable
 * BIM scope key is the building-storey `floorId`, which lives on the `Level`
 * doc and survives the save-target reset. So the gate now requires a valid
 * identity (`companyId`/`projectId`/`userId`) plus AT LEAST ONE scope key —
 * `floorId` (preferred) OR `floorplanId` (legacy/project-level fallback). A
 * floor with a durable `floorId` but no DXF file therefore keeps persisting
 * its BIM entities (Revit: every storey is its own drawing space).
 *
 * @returns the resolved scope, or `null` when the service must stay un-instantiated.
 */
export function resolveBimPersistenceScope(
  input: BimPersistenceScopeInput,
): ResolvedBimPersistenceScope | null {
  const companyId = input.companyId || undefined;
  const projectId = input.projectId || undefined;
  const userId = input.userId || undefined;
  const floorId = input.floorId || undefined;
  const fileProvenance = input.floorplanId || undefined;

  if (!companyId || !projectId || !userId) return null;
  // ADR-420 — floorId is the preferred durable scope key; floorplanId is the
  // legacy/project-level fallback. Need at least one.
  const scopeKey = floorId ?? fileProvenance;
  if (!scopeKey) return null;

  return {
    companyId,
    projectId,
    userId,
    ...(floorId ? { floorId } : {}),
    // Mirror floorId into the provenance slot for a file-less floor so the
    // service config stays valid; with a real file, keep the file id.
    floorplanId: fileProvenance ?? scopeKey,
  };
}
